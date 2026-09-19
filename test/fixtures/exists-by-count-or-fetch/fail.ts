export async function hasOrders(userId: number) {
  return (await prisma.order.findMany({ where: { userId } })).length > 0; // expect: exists-by-count-or-fetch
}
