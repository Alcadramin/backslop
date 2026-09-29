export function feed(posts: Post[]) {
  const out: Post[] = [];
  for (const p of posts) {
    out.push(p);
    out.sort((a, b) => b.createdAt - a.createdAt); // expect: sort-in-loop
  }
  return out;
}
