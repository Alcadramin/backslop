import fs from 'node:fs';

export function honest(rows: Row[], bannedIds: string[], configPath: string, files: string[]) {
  const banned = new Set(bannedIds);
  const kept = rows.filter((r) => !banned.has(r.userId));
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
  }
  for (const r of rows) {
    const seen = new Set();
    const own = new Set(r.tags);
  }
  return { kept, cfg };
}
