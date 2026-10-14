export async function placeOrder(data: OrderInput, items: Item[]) {
  const order = await prisma.order.create({ data });
  await prisma.item.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
  return order;
}
