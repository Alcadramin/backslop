export function honest(rows: Row[]) {
  const tags = new Set<string>();
  for (const r of rows) for (const t of r.tags) tags.add(t);
  let all: string[] = [];
  for (const r of rows) all.push(...r.tags);
  all = [...new Set(all)];
  for (const r of rows) {
    const own = [...new Set(r.tags)];
  }
  return { tags, all };
}
