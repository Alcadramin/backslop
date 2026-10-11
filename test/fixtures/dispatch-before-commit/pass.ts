import PQueue from 'p-queue';
const queue = new PQueue({ concurrency: 2 });

export async function placeOrder(data: OrderInput) {
  const o = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    await tx.outbox.create({ data: { topic: 'process-order', payload: { id: order.id } } });
    await queue.add(async () => tx.audit.create({ data: { orderId: order.id } })); // in-process p-queue, not a broker
    return order;
  });
  await ordersQueue.add('process-order', { id: o.id });
  return o;
}
