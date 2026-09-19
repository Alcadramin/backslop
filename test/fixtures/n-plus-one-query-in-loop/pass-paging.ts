export async function exportAll() {
  // paging loop: one bounded query per page of 500 is the batching, not N+1
  for (let skip = 0; ; skip += 500) {
    const rows = await prisma.order.findMany({ orderBy: { id: "asc" }, skip, take: 500 });
    if (rows.length === 0) break;
  }
}
