export async function latest(userId: number) {
  const a = await prisma.order.findFirst({ where: { userId }, orderBy: { id: 'desc' } });
  const page = await prisma.order.findMany({ where: { userId }, take: 20 });
  const mine = await prisma.order.findMany({ where: { userId } });
  return [a, page[0], mine.find((o) => o.id === 1)];
}
