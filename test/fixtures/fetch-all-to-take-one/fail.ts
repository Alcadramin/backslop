export async function latest(userId: number) {
  const a = (await prisma.order.findMany({ where: { userId } }))[0]; // expect: fetch-all-to-take-one
  const roles = await prisma.role.findMany();
  return [a, roles.find((r) => r.name === 'admin')]; // expect: fetch-all-to-take-one
}
