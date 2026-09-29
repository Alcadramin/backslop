export function honest(posts: Post[], groups: Group[]) {
  const out: Post[] = [];
  for (const p of posts) out.push(p);
  out.sort((a, b) => b.createdAt - a.createdAt);
  for (const g of groups) g.items.sort();
  return out;
}
