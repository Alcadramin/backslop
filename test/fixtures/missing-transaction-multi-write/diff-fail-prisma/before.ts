export async function placeOrder(data: OrderInput, items: Item[]) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    await tx.item.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
    return order;
  });
}
