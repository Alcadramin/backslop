export function total(order: Order): number {
  return order.lines.reduce((s, l) => s + l.price, 0);
}
