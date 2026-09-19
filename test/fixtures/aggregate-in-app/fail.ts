export async function revenue() {
  return (await prisma.order.findMany({ where: { paid: true } })).reduce((s, o) => s + o.total, 0); // expect: aggregate-in-app
}
