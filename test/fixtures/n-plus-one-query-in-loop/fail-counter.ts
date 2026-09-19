export async function lookup(ids: number[]) {
  for (let i = 0; i < ids.length; i++) {
    await prisma.order.findFirst({ where: { id: ids[i] } }); // expect: n-plus-one-query-in-loop
  }
}
