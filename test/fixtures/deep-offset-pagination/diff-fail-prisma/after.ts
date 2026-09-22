export async function feed(page = 1) {
  return prisma.post.findMany({
    take: 20,
    orderBy: { id: 'desc' },
    skip: (page - 1) * 20,
  });
}
