export async function ownersFor(projects: { ownerId: string }[]) {
  const out = [];
  for (const p of projects) {
    out.push(await prisma.user.findUnique({ where: { id: p.ownerId } }));
  }
  return out;
}
