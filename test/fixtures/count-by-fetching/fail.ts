export async function countOrders(userId: number) {
  const n = (await prisma.order.findMany({ where: { userId } })).length; // expect: count-by-fetching
  const all = await prisma.user.findMany();
  return { n, users: all.length }; // expect: count-by-fetching
}

export async function openIssueCount(teamId: string) {
  const issues = await prisma.issue.findMany({ where: { teamId } });
  return issues.filter((i) => i.state === 'open').length; // expect: count-by-fetching
}
