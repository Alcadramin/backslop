export async function activeUsers(teamId: number) {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  const team = await prisma.user.findMany({ where: { teamId } });
  const admins = team.filter((u) => u.role === 'admin'); // bounded by the team filter
  const top = (await prisma.post.findMany({ take: 10 })).sort((a, b) => a.id - b.id);
  return [users, admins, top];
}
