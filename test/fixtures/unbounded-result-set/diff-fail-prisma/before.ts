export async function listOrders(cursor?: number) {
  return prisma.order.findMany({
    where: { status: 'open' },
    orderBy: { id: 'asc' },
    take: 50,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
}
