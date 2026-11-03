export async function listOrders() {
  // backslop-ignore
  return prisma.order.findMany();
}
