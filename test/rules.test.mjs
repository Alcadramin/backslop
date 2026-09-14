// fail*: fires only on `expect:` lines; diff-fail*: fires; *pass*: never.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules, scanText, scanDiff } from '../skills/backslop/scripts/lib/engine.mjs';
import { diffTwoFiles } from '../skills/backslop/scripts/lib/diff.mjs';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const SKILLS = new URL('../skills/', import.meta.url).pathname;
const rules = await loadRules();

// Fake project paths so path-scoped rules (tests/, migrations/) apply.
function virtualPath(name) {
  if (name.includes('.test.') || name.includes('.spec.') || name.includes('_test.') || name.startsWith('test_') || /Test\.php$/.test(name)) return `tests/${name}`;
  if (name.includes('migration')) return `database/migrations/${name}`;
  return `src/${name}`;
}

for (const rule of rules) {
  const dir = join(FIX, rule.id);
  test(`${rule.skill}/${rule.id}`, () => {
    assert.ok(existsSync(dir), `missing fixtures dir test/fixtures/${rule.id}`);
    const entries = readdirSync(dir);
    let failCases = 0;
    for (const name of entries) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        const [before] = readdirSync(p).filter((f) => f.startsWith('before.'));
        const [after] = readdirSync(p).filter((f) => f.startsWith('after.'));
        assert.ok(before && after, `${rule.id}/${name} needs before.* and after.*`);
        const display = existsSync(join(p, 'path')) ? readFileSync(join(p, 'path'), 'utf8').trim() : virtualPath(after.replace(/^after/, 'file'));
        const { files, read } = diffTwoFiles(join(p, before), join(p, after), display);
        const hits = scanDiff([rule], files, read).filter((f) => f.id === rule.id);
        if (name.startsWith('diff-fail')) { failCases++; assert.ok(hits.length > 0, `${rule.id}/${name}: expected a finding, got none`); }
        else if (name.startsWith('diff-pass')) assert.equal(hits.length, 0, `${rule.id}/${name}: unexpected ${JSON.stringify(hits.map((h) => h.line))}`);
        continue;
      }
      const text = readFileSync(p, 'utf8');
      const virt = virtualPath(name);
      const hits = scanText([rule], virt, text).filter((f) => f.id === rule.id);
      const got = new Set(hits.map((h) => h.line));
      if (name.startsWith('fail')) {
        failCases++;
        const want = new Set();
        text.split('\n').forEach((l, i) => {
          if (new RegExp(`expect:\\s*${rule.id}\\b`).test(l)) want.add(i + 1);
          if (new RegExp(`expect-next:\\s*${rule.id}\\b`).test(l)) want.add(i + 2); // for rules about comments or the marker line itself
        });
        assert.ok(want.size > 0, `${rule.id}/${name} has no "expect: ${rule.id}" markers`);
        for (const l of want) assert.ok(got.has(l), `${rule.id}/${name}:${l} should fire`);
        for (const l of got) assert.ok(want.has(l), `${rule.id}/${name}:${l} fired but is not marked expect`);
      } else if (name.startsWith('pass')) {
        assert.equal(hits.length, 0, `${rule.id}/${name}: false positive on lines ${[...got].join(', ')}`);
      }
    }
    assert.ok(failCases > 0, `${rule.id} needs at least one fail fixture`);
    assert.ok(entries.some((n) => n.startsWith('pass') || n.startsWith('diff-pass')), `${rule.id} needs at least one pass fixture`);
  });
}

test('every rule has a reference page in its skill', () => {
  for (const r of rules) assert.ok(existsSync(join(SKILLS, r.skill, 'references', `${r.id}.md`)), `missing skills/${r.skill}/references/${r.id}.md`);
});

test('every skill has valid SKILL.md frontmatter', () => {
  for (const name of readdirSync(SKILLS)) {
    const p = join(SKILLS, name, 'SKILL.md');
    assert.ok(existsSync(p), `missing ${p}`);
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(p, 'utf8'));
    assert.ok(fm, `${name}: no frontmatter`);
    const nm = /^name:\s*(.+)$/m.exec(fm[1])?.[1].trim();
    const desc = /^description:\s*(.+)$/m.exec(fm[1])?.[1].trim();
    assert.equal(nm, name, `${name}: frontmatter name must match folder`);
    assert.match(nm, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(desc && desc.length <= 1024, `${name}: description missing or over 1024 chars`);
    assert.ok(readFileSync(p, 'utf8').split('\n').length < 500, `${name}: SKILL.md over 500 lines`);
  }
});

test('every skill a rule names exists', () => {
  for (const r of rules) assert.ok(existsSync(join(SKILLS, r.skill)), `rule ${r.id} names unknown skill ${r.skill}`);
});
