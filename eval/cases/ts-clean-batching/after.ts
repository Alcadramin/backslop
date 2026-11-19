export async function ownersFor(projects: { ownerId: string }[]) {
  const ids = [...new Set(projects.map((p) => p.ownerId))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, take: ids.length });
  const byId = new Map(users.map((u) => [u.id, u]));
  return projects.map((p) => byId.get(p.ownerId));
}
