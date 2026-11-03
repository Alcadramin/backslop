export function total(order: Order): number {
  // @ts-ignore
  const lines = order.lines as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return lines.reduce((s, l) => s + l.price, 0);
}
