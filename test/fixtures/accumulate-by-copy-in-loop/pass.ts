export function honest(items: Item[], groups: Group[], state: State) {
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));

  const all: Item[] = [];
  for (const g of groups) all.push(...g.items);

  const flat = groups.flatMap((g) => g.items);

  // reduce that mutates its accumulator: linear
  const counts = items.reduce((acc, x) => {
    acc[x.kind] = (acc[x.kind] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // fixed keys: the object never grows, so the copy is constant-size
  let totals = { count: 0, sum: 0 };
  for (const x of items) {
    totals = { ...totals, count: totals.count + 1, sum: totals.sum + x.price };
  }

  // one immutable update, not in a loop
  const next = { ...state, loading: false };

  // a fresh copy of another variable per iteration
  for (const g of groups) {
    const copy = [...g.items];
    copy.sort();
  }

  return { byId, all, flat, counts, totals, next };
}
