export async function revenue(page: { total: number }[]) {
  const { _sum } = await prisma.order.aggregate({ where: { paid: true }, _sum: { total: true } });
  const shown = page.reduce((s, o) => s + o.total, 0);
  const firstTen = (await prisma.order.findMany({ take: 10 })).reduce((s, o) => s + o.total, 0);
  return [_sum, shown, firstTen];
}
