export async function feed(cursor?: number) {
  return prisma.post.findMany({
    take: 20,
    orderBy: { id: 'desc' },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
}
