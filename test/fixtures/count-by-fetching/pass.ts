export async function countOrders(userId: number) {
  const n = await prisma.order.count({ where: { userId } });
  const page = await prisma.order.findMany({ where: { userId }, take: 20 });
  const firstPage = (await prisma.order.findMany({ take: 50 })).length; // bounded
  const mine = await prisma.order.findMany({ where: { userId } });
  return { n, page, firstPage, shown: mine.length, items: mine, title: 'findMany().length' }; // rows are used, not only counted
}
