export async function importPrices(rows: Price[]) {
  for (const r of rows) {
    await prisma.price.create({ data: r }); // expect: row-by-row-writes
  }
  await Promise.all(rows.map((r) => tx.auditLog.create({ data: { sku: r.sku } }))); // expect: row-by-row-writes
  for (const u of users) {
    await this.userRepository.save(u); // expect: row-by-row-writes
  }
}
