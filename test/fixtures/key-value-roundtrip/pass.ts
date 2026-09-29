export function honest(prices: Record<string, number>, other: Record<string, number>, users: Record<string, User>) {
  const values = Object.values(prices);
  // reads a different object: a real join by key
  const joined = Object.keys(prices).map((k) => other[k]);
  // transforms entries: not a round-trip
  const doubled = Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v * 2]));
  const labels = Object.entries(users).map(([id, u]) => `${id}: ${u.name}`);
  return { values, joined, doubled, labels };
}
