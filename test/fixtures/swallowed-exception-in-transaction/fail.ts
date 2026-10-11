export async function place(data: OrderInput, items: Item[]) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    try {
      await tx.item.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
    } catch (e) { // expect: swallowed-exception-in-transaction
      console.error('items failed', e);
    }
    return order;
  });
}
