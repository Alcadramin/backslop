export async function listOrders() {
  return prisma.order.findMany({
    where: { status: 'open' },
    orderBy: { id: 'asc' },
  });
}
