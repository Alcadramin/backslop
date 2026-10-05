import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strip, parse, inLoop, inKind, loopDepth, lineOf } from '../skills/backslop/scripts/lib/source.mjs';
import { parseUnified } from '../skills/backslop/scripts/lib/diff.mjs';
import { scanText } from '../skills/backslop/scripts/lib/engine.mjs';

const CLI = new URL('../skills/backslop/scripts/backslop.mjs', import.meta.url).pathname;

test('strip keeps length and blanks comments/strings per view', () => {
  const cases = [
    ['php', `<?php\n// a in_array(\n$x = "in_array(" . 'b'; # c\n/* d */ $y = <<<SQL\nSELECT 1\nSQL;\n#[Attr]\n`],
    ['js', `const r = /in_array(/g; // x\nconst s = \`a \${b}\`; /* c */ const t = a / b / c;\n`],
    ['py', `x = """in_array(\n"""  # c\ny = f'{a}' + r"b"\n`],
  ];
  for (const [lang, src] of cases) {
    const { noComments, code } = strip(src, lang);
    assert.equal(noComments.length, src.length, lang);
    assert.equal(code.length, src.length, lang);
    assert.equal(noComments.split('\n').length, src.split('\n').length, lang);
    assert.ok(!/in_array/.test(code), `${lang}: string/comment/regex content left in code view`);
  }
  assert.match(strip(`$q = "SELECT * FROM t"; // LIMIT 5`, 'php').noComments, /SELECT \* FROM t/);
  assert.doesNotMatch(strip(`$q = "SELECT * FROM t"; // LIMIT 5`, 'php').noComments, /LIMIT/);
  assert.match(strip(`#[Route('/x')]\nfunction a() {}`, 'php').code, /#\[Route/); // attributes are not comments
  assert.match(strip(`const a = b / c; const d = e / f;`, 'js').code, /e \/ f/); // division is not a regex
});

function at(src, path, needle) {
  const f = parse(path, src);
  return { f, o: f.raw.indexOf(needle) };
}

test('loop scopes: statements, callbacks, comprehensions; function boundary stops', () => {
  const php = `<?php
foreach ($a as $x) { A1(); }
$r = array_map(function ($x) { return A2($x); }, $a);
$r = array_filter($a, fn($x) => A3($x));
foreach ($a as $x) { $f = function () { return N1(); }; }
while ($i < 3) { $i++; A4(); }
N2();`;
  for (const n of ['A1', 'A2', 'A3', 'A4']) { const { f, o } = at(php, 'x.php', n); assert.ok(inLoop(f, o), `php ${n} should be in loop`); }
  for (const n of ['N1', 'N2']) { const { f, o } = at(php, 'x.php', n); assert.ok(!inLoop(f, o), `php ${n} should not be in loop`); }

  const js = `for (const x of xs) { A1(); }
xs.forEach((x) => { A2(); });
const m = xs.map(x => A3(x));
const o = { a: 1, b: N1() };
function plain() { return N2(); }
for (let i = 0; i < n; i++) A4();
await Promise.all(xs.map(async (x) => { await A5(x); }));`;
  for (const n of ['A1', 'A2', 'A3', 'A5']) { const { f, o } = at(js, 'x.ts', n); assert.ok(inLoop(f, o), `js ${n} should be in loop`); }
  for (const n of ['N1', 'N2']) { const { f, o } = at(js, 'x.ts', n); assert.ok(!inLoop(f, o), `js ${n} should not be in loop`); }

  const py = `for x in xs:
    A1()
y = [A2(x) for x in xs]
def f():
    return N1()
N2()
while True:
    A3()
`;
  for (const n of ['A1', 'A2', 'A3']) { const { f, o } = at(py, 'x.py', n); assert.ok(inLoop(f, o), `py ${n} should be in loop`); }
  for (const n of ['N1', 'N2']) { const { f, o } = at(py, 'x.py', n); assert.ok(!inLoop(f, o), `py ${n} should not be in loop`); }
});

test('transaction scopes in PHP, TS, Python', () => {
  const cases = [
    ['x.php', `<?php DB::transaction(function () { IN(); }); OUT();`],
    ['x.ts', `await prisma.$transaction(async (tx) => { await IN(); }); OUT();`],
    ['x.ts', `await knex.transaction(async (trx) => { IN(); }); OUT();`],
    ['x.py', `with transaction.atomic():\n    IN()\nOUT()\n`],
  ];
  for (const [p, src] of cases) {
    const f = parse(p, src);
    assert.ok(inKind(f, src.indexOf('IN'), 'transaction'), `${p}: IN inside transaction`);
    assert.ok(!inKind(f, src.indexOf('OUT'), 'transaction'), `${p}: OUT outside transaction`);
  }
});

test('lineOf is 1-based', () => {
  const f = parse('a.js', 'a\nb\nc');
  assert.equal(lineOf(f, 0), 1);
  assert.equal(lineOf(f, 2), 2);
  assert.equal(lineOf(f, 4), 3);
});

test('parseUnified tracks old/new line numbers', () => {
  const d = parseUnified(`diff --git a/x.php b/x.php
--- a/x.php
+++ b/x.php
@@ -3,2 +3,1 @@
-  ->limit(5)
-  ->get();
+  ->get();
@@ -10 +9,2 @@
-a
+b
+c
`);
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].removed.map((r) => [r.line, r.near]), [[3, 3], [4, 3], [10, 9]]);
  assert.deepEqual(d[0].added.map((a) => a.line), [3, 9, 10]);
});

test('backslop-ignore suppresses by id on the line or the line above', () => {
  const rule = { id: 'demo-rule', skill: 's', severity: 'low', title: 't', fix: 'f', file: (f, h) => h.match(f, /BAD\(/g) };
  const src = `BAD();\nBAD(); // backslop-ignore: demo-rule -- fine here\n// backslop-ignore: other-rule\nBAD();\n// backslop-ignore\nBAD();\n`;
  const lines = scanText([rule], 'a.js', src).map((x) => x.line);
  assert.deepEqual(lines, [1, 4]);
});

test('Stop hook: blocks once on a session regression, ignores pre-existing work, fails open outside git', () => {
  const repo = mkdtempSync(join(tmpdir(), 'backslop-repo-'));
  const data = mkdtempSync(join(tmpdir(), 'backslop-data-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  writeFileSync(join(repo, 'Orders.php'), `<?php\n$orders = Order::where('status', 'open')->orderBy('id')->paginate(50);\n`);
  g('add', '.');
  g('commit', '-qm', 'init');
  // A pre-existing untracked file must not be blamed on this session.
  writeFileSync(join(repo, 'Old.php'), `<?php\n$x = Order::all();\n`);

  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data };
  const run = (sub, input) => spawnSync('node', [CLI, 'hook', sub], { input: JSON.stringify(input), env, encoding: 'utf8' });

  assert.equal(run('baseline', { session_id: 's1', cwd: repo, source: 'startup' }).status, 0);
  const clean = run('stop', { session_id: 's1', cwd: repo, stop_hook_active: false });
  assert.equal(clean.status, 0);
  assert.equal(clean.stdout.trim(), '', 'no changes -> no block');

  writeFileSync(join(repo, 'Orders.php'), `<?php\n$orders = Order::where('status', 'open')->orderBy('id')->get();\n`);
  const blocked = run('stop', { session_id: 's1', cwd: repo, stop_hook_active: false });
  assert.equal(blocked.status, 0);
  const out = JSON.parse(blocked.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /unbounded-result-set/);
  assert.doesNotMatch(out.reason, /Old\.php/);

  const again = run('stop', { session_id: 's1', cwd: repo, stop_hook_active: true });
  assert.equal(again.stdout.trim(), '', 'same finding is reported once');

  const cursor = spawnSync('node', [CLI, 'hook', 'stop', '--cursor'], { input: JSON.stringify({ conversation_id: 'c1', workspace_roots: [repo] }), env, encoding: 'utf8' });
  assert.match(JSON.parse(cursor.stdout).followup_message, /unbounded-result-set/);

  const outside = run('stop', { session_id: 's2', cwd: data });
  assert.equal(outside.status, 0);
  assert.equal(outside.stdout.trim(), '');
  const garbage = spawnSync('node', [CLI, 'hook', 'stop'], { input: 'not json', env, encoding: 'utf8', cwd: data });
  assert.equal(garbage.status, 0);
});

test('install-hook merges into existing settings without clobbering', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backslop-inst-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('mkdir', ['-p', join(dir, '.claude')]);
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } }));
  for (let i = 0; i < 2; i++) execFileSync('node', [CLI, 'install-hook'], { cwd: dir });
  const cfg = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(cfg.permissions, { allow: ['Bash(ls)'] });
  assert.equal(cfg.hooks.Stop.length, 2, 'own hook kept, backslop added once');
  assert.equal(cfg.hooks.SessionStart.length, 1);
});

test('engine fixes from skill builders: scope accuracy', () => {
  const check = (path, src, needle, pred, msg) => { const f = parse(path, src); assert.ok(pred(f, f.raw.indexOf(needle)), `${path}: ${msg}`); };
  const notIn = (f, o) => !inLoop(f, o);
  check('a.ts', 'function x(){\n for (let i = 0; i < 3; i++) {\n  HIT(u);\n }\n}', 'HIT', inLoop, 'C-style for body is a loop');
  check('a.php', '<?php\nfor ($i = 0; $i < 3; $i++) { HIT(); }', 'HIT', inLoop, 'PHP C-style for body is a loop');
  check('a.php', '<?php\n$users->each(function (User $u): void {\n  HIT($u);\n});', 'HIT', inLoop, '->each(function) body is a loop');
  check('a.php', '<?php\n$r = collect($ids)->map(fn ($id) => HIT($id));', 'HIT', inLoop, '->map(fn) body is a loop');
  check('a.php', '<?php\n$r = array_map(fn ($tz) => $tz->label, ONCE());', 'ONCE', notIn, 'array_map list argument is not in the loop');
  check('a.php', '<?php\n$r = array_filter(ONCE(), fn ($x) => $x > 1);', 'ONCE', notIn, 'array_filter list argument is not in the loop');
  // one callback is one loop, not two
  { const src = 'xs.forEach((x) => { HIT(x); });'; const f = parse('a.ts', src); assert.equal(loopDepth(f, src.indexOf('HIT')), 1); }
  check('a.ts', 'const r = items.map((i) => i.id).concat(await prisma.x.findMany({ where: ONCE() }));', 'ONCE', notIn, 'object literal after closed .map() is not a loop');
  check('a.php', '<?php\nDB::transaction(fn () => HIT($url));', 'HIT', (f, o) => inKind(f, o, 'transaction'), 'DB::transaction(fn) is a transaction');
  check('a.ts', 'await prisma.$transaction(async (tx) => HIT(url));', 'HIT', (f, o) => inKind(f, o, 'transaction'), '$transaction(async tx => expr) is a transaction');
  check('a.py', 'class G:\n    def refund(\n        self,\n        x,\n    ):\n        HIT()\n', 'HIT', (f, o) => inKind(f, o, 'function'), 'multi-line def signature opens a function');
  check('a.py', 'try:\n    a()\nexcept Exception: HIT()\n', 'HIT', (f, o) => inKind(f, o, 'catch'), 'one-line except is a catch scope');
  check('a.py', 'for x in xs: HIT(x)\nAFTER()\n', 'HIT', inLoop, 'one-line for is a loop');
  check('a.py', 'for x in xs: f(x)\nAFTER()\n', 'AFTER', notIn, 'code after one-line for is not in loop');
  check('a.py', '@transaction.atomic\ndef f():\n    HIT()\n', 'HIT', (f, o) => inKind(f, o, 'transaction'), '@transaction.atomic def body is a transaction');
  check('a.py', 'y = [x.id for x in ONCE() if HIT(x)]\n', 'ONCE', notIn, 'comprehension iterable runs once');
  check('a.py', 'y = [x.id for x in ONCE() if HIT(x)]\n', 'HIT', inLoop, 'comprehension condition runs per element');
  check('a.py', 'v = tuple(\n    Q.filter(id__in={rv.id for rv in rows}), ONCE()\n)\n', 'ONCE', notIn, 'nested comprehension does not make the outer call a loop');
  check('a.py', 'if (n := len(xs)) > 3:\n    HIT()\n', 'HIT', (f, o) => !inLoop(f, o), 'walrus colon is not a header colon');
  check('a.ts', "for (const r of rs) {\n  class A {\n    @Get(':id')\n    find(id: string) {\n      return HIT();\n    }\n  }\n}", 'HIT', notIn, 'decorated method body is a function, not part of the outer loop');
});

test('text pseudo-language: manifests and CI files reach opt-in rules only', () => {
  const ci = { id: 'demo-ci', skill: 's', severity: 'low', title: 't', fix: 'f', langs: ['text'], file: (f, h) => h.match(f, /continue-on-error:\s*true/g, { view: 'noComments' }) };
  const code = { id: 'demo-code', skill: 's', severity: 'low', title: 't', fix: 'f', langs: ['js'], file: (f, h) => h.match(f, /true/g, { view: 'raw' }) };
  const yml = `jobs:\n  test:\n    steps:\n      - run: npm test\n        continue-on-error: true\n      # continue-on-error: true  (commented out)\n`;
  const hits = scanText([ci, code], '.github/workflows/ci.yml', yml);
  assert.deepEqual(hits.map((h) => [h.id, h.line]), [['demo-ci', 5]]);
  assert.equal(scanText([ci], 'package-lock.json', '{"continue-on-error: true": 1}').length, 0, 'lockfiles are never scanned');
});
