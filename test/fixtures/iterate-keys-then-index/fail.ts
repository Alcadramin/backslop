export function total(prices: Record<string, number>) {
  let sum = 0;
  Object.keys(prices).forEach((k) => { // expect: iterate-keys-then-index
    sum += prices[k];
  });
  for (const sku of Object.keys(prices)) { // expect: iterate-keys-then-index
    console.log(sku, prices[sku]);
  }
  return sum;
}
