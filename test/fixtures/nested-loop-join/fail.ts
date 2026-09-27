export async function usersWithOrders(ids: string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const orders = await prisma.order.findMany({ where: { userId: { in: ids } } });
  return users.map((u) => ({ ...u, orders: orders.filter((o) => o.userId === u.id) })); // expect: nested-loop-join
}

export async function counts(rules: Rule[]) {
  const [recentCounts, totals] = await Promise.all([countRecent(), countAll()]);
  const out = [];
  for (const rule of rules) {
    out.push({
      rule,
      recent: recentCounts.find((c) => c.ruleId === rule.id)?.count ?? 0, // expect: nested-loop-join
    });
  }
  return out;
}
