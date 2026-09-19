export async function hasOrders(userId: number) {
  const one = await prisma.order.findFirst({ where: { userId }, select: { id: true } });
  const page = (await prisma.order.findMany({ where: { userId }, take: 1 })).length > 0;
  return one !== null || page;
}
