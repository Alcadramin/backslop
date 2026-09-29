import fs from 'node:fs';

export function load(rows: Row[], bannedIds: string[], configPath: string) {
  const kept = rows.filter((r) => !new Set(bannedIds).has(r.userId)); // expect: loop-invariant-work
  for (const r of rows) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); // expect: loop-invariant-work
    r.label = cfg[r.code];
  }
  return kept;
}
