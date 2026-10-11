export async function markPaid(id: string) {
  const o = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({ where: { id }, data: { status: 'paid' } });
    await tx.outbox.create({ data: { topic: 'order.paid', payload: { id } } });
    const cached = await cache.fetch(`order:${id}`);
    const user = await this.fetch(order.userId);
    const rows = await fetchLines(tx, id);
    return order;
  });
  await fetch('https://erp.example.com/orders', { method: 'POST', body: JSON.stringify(o) });
  await axios.post('https://hooks.example.com', o);
}

// array form: no callback body
export const both = () => prisma.$transaction([prisma.a.update({ where: { id: 1 }, data: {} })]);

export async function later(id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: 'paid' } });
    // await fetch('https://erp.example.com/orders');
  });
}
