const STATUSES = ['open', 'paid'];

export function honest(orders: Order[], bannedIds: string[], title: string) {
  const banned = new Set(bannedIds);
  const kept = orders.filter((o) => !banned.has(o.userId));

  // a module constant: fixed and small
  const open = orders.filter((o) => STATUSES.includes(o.status));

  // a literal list
  const shipped = orders.filter((o) => ['shipped', 'delivered'].includes(o.status));

  // String#includes is a substring test, not a list scan
  const prefix = 'ORD-';
  const matching = orders.filter((o) => o.ref.includes(prefix) || title.includes(o.ref));

  // the list belongs to the current item
  const gifts = orders.filter((o) => o.tags.includes('gift'));

  // not in a loop
  const isBanned = bannedIds.includes(orders[0].userId);

  // literal small array assigned to a variable
  const kinds = ['a', 'b'];
  const typed = orders.filter((o) => kinds.includes(o.kind));

  return { kept, open, shipped, matching, gifts, isBanned, typed };
}
