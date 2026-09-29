export function honest(prices: Record<string, number>, other: Record<string, number>) {
  let sum = 0;
  for (const [sku, price] of Object.entries(prices)) sum += price;
  // writes back
  for (const sku of Object.keys(prices)) {
    prices[sku] = Math.round(prices[sku]);
  }
  // reads another object
  Object.keys(prices).forEach((k) => {
    sum += other[k];
  });
  return sum;
}
