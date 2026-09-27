export function visible(orders: Order[], bannedIds: string[]) {
  const banned = new Set(bannedIds);
  return orders.filter((o) => !banned.has(o.userId));
}
