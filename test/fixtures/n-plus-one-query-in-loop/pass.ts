export async function hydrate(posts: Post[], layer: Layer) {
  const authors = await prisma.user.findMany({ where: { id: { in: posts.map((p) => p.authorId) } } });
  const byId = new Map(authors.map((a) => [a.id, a]));
  for (const p of posts) {
    p.author = byId.get(p.authorId);
    const shape = layer.findOne(`#${p.id}`);            // canvas lookup, not a query
  }
  // Prisma batches findUnique calls made in the same tick
  const users = await Promise.all(posts.map((p) => prisma.user.findUnique({ where: { id: p.authorId } })));
  for (const status of ['draft', 'published']) {
    await prisma.post.count({ where: { status } });
  }
  return users;
}
