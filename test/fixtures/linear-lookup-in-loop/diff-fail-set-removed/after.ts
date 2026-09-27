export function visible(orders: Order[], bannedIds: string[]) {
  // simplified: no extra Set needed
  return orders.filter((o) => !bannedIds.includes(o.userId));
}
