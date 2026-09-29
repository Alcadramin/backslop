export function roundtrips(prices: Record<string, number>, users: Record<string, User>) {
  const values = Object.keys(prices).map((k) => prices[k]); // expect: key-value-roundtrip
  const vals2 = Object.entries(users).map(([, u]) => u); // expect: key-value-roundtrip
  const keys = Object.entries(users).map(([id]) => id); // expect: key-value-roundtrip
  const copy = Object.fromEntries(Object.entries(prices)); // expect: key-value-roundtrip
  return { values, vals2, keys, copy };
}
