export function calculateTotal(lines: Line[]): number {
  let total = 0;
  for (const l of lines) total += l.price * l.qty;
  return total;
}

export const calculateTotalOptimized = (lines: Line[]): number =>
  lines.reduce((sum, l) => sum + l.price * l.qty, 0);
