export async function visibleOrders(orders: Order[], bannedIds: string[]) {
  return orders.filter((o) => !bannedIds.includes(o.userId)); // expect: linear-lookup-in-loop
}

export async function tag(rows: Row[]) {
  const ids = rows.map((r) => r.id);
  const out = [];
  for (const r of rows) {
    if (ids.indexOf(r.parentId) === -1) { // expect: linear-lookup-in-loop
      out.push(r);
    }
  }
  return out;
}

export function uniqueIds(items: Item[]) {
  const seen = [];
  for (const it of items) {
    if (!seen.includes(it.id)) seen.push(it.id); // expect: linear-lookup-in-loop
  }
  return seen;
}

export function keepKnown(rows: Row[], users: User[]) {
  const known = Object.keys(byId(users));
  return rows.filter((r) => known.includes(r.userId)); // expect: linear-lookup-in-loop
}
