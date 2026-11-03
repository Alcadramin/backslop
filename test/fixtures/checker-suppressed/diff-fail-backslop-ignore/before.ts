export async function listOrders() {
  return prisma.order.findMany({ take: 50 });
}
