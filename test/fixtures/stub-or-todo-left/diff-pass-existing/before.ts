export function price(cents: number) {
  // TODO(#88): support currencies other than EUR
  return `€${(cents / 100).toFixed(2)}`;
}
