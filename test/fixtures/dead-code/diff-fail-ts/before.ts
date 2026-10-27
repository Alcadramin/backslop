export function calculateTotal(lines: Line[]): number {
  let total = 0;
  for (const l of lines) total += l.price * l.qty;
  return total;
}
