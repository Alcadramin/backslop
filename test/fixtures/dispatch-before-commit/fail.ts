export async function placeOrder(data: OrderInput) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.order.create({ data });
    await ordersQueue.add('process-order', { id: o.id }); // expect: dispatch-before-commit
    await sqs.send(new SendMessageCommand({ QueueUrl: url, MessageBody: o.id })); // expect: dispatch-before-commit
    await inngest.send({ name: 'order/placed', data: { id: o.id } }); // expect: dispatch-before-commit
    return o;
  });
}
