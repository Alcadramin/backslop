export function calculateTotalV2(lines: Line[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}
