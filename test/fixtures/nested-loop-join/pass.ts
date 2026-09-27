export async function honest(ids: string[], fields: Field[], recipients: Recipient[]) {
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const orders = await prisma.order.findMany({ where: { userId: { in: ids } } });

  const byUser = Map.groupBy(orders, (o) => o.userId);
  const joined = users.map((u) => ({ ...u, orders: byUser.get(u.id) ?? [] }));

  // child collection of the outer item
  const withItems = orders.map((o) => o.items.find((i) => i.sku === o.mainSku));

  // a small list passed in, not loaded here: left to review
  const named = fields.map((f) => recipients.find((r) => r.id === f.recipientId));

  // not inside another loop
  const first = orders.find((o) => o.userId === ids[0]);

  // comparison with a constant, not with the outer item
  const refunded = users.map((u) => orders.filter((o) => o.status === 'refunded').length);

  return { joined, withItems, named, first, refunded };
}
