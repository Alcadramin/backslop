export function collect(rows: Row[]) {
  let tags: string[] = [];
  for (const r of rows) {
    tags = [...new Set([...tags, ...r.tags])]; // expect: dedupe-in-loop
  }
  return tags;
}
