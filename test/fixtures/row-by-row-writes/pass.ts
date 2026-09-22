export async function importPrices(rows: Price[], cache: Map<string, number>) {
  await prisma.price.createMany({ data: rows, skipDuplicates: true });
  await prisma.order.updateMany({ where: { status: 'stale' }, data: { archived: true } });
  for (const r of rows) {
    cache.delete(r.sku);                       // a Map, not a table
  }
  for (const chunk of chunks(rows, 500)) {
    await prisma.price.createMany({ data: chunk });
  }
}
