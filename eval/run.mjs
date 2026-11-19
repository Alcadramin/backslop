#!/usr/bin/env node
// Eval: scores hand-written agent diffs (see eval/README.md) against rule ids.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules, scanDiff } from '../skills/backslop/scripts/lib/engine.mjs';
import { diffTwoFiles } from '../skills/backslop/scripts/lib/diff.mjs';

const dir = process.argv[2] ? new URL(`./${process.argv[2].replace(/\/?$/, '/')}`, import.meta.url).pathname : new URL('./cases/', import.meta.url).pathname;
const rules = await loadRules();
let expected = 0, hit = 0, falsePos = 0, extras = 0;
const rows = [];

for (const name of readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort()) {
  const p = join(dir, name);
  const files = readdirSync(p);
  const before = files.find((f) => f.startsWith('before.'));
  const after = files.find((f) => f.startsWith('after.'));
  const c = JSON.parse(readFileSync(join(p, 'case.json'), 'utf8'));
  const display = existsSync(join(p, 'path')) ? readFileSync(join(p, 'path'), 'utf8').trim() : `app/${after.replace(/^after/, name)}`;
  const { files: diff, read } = diffTwoFiles(join(p, before), join(p, after), display);
  const found = scanDiff(rules, diff, read);
  const ids = new Set(found.map((f) => f.id));
  const missed = c.expect.filter((id) => !ids.has(id));
  const extra = [...ids].filter((id) => !c.expect.includes(id) && !(c.optional ?? []).includes(id));
  expected += c.expect.length;
  hit += c.expect.length - missed.length;
  if (c.expect.length === 0) falsePos += extra.length; else extras += extra.length;
  rows.push({ name, clean: c.expect.length === 0, want: c.expect.length, got: c.expect.length - missed.length, missed, extra });
}

for (const r of rows) {
  const status = r.clean ? (r.extra.length ? 'FALSE POSITIVE' : 'clean ok') : `${r.got}/${r.want}`;
  console.log(`${r.name.padEnd(28)} ${status.padEnd(15)}${r.missed.length ? ` missed: ${r.missed.join(', ')}` : ''}${r.extra.length ? ` extra: ${r.extra.join(', ')}` : ''}`);
}
console.log(`\nrecall ${hit}/${expected} expected findings, ${falsePos} false positives on clean changes, ${extras} extra findings on regression cases`);
process.exit(hit === expected && falsePos === 0 ? 0 : 1);
