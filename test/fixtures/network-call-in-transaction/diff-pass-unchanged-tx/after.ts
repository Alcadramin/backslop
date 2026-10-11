export async function markPaid(id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: 'paid', paidAt: new Date() } });
    await fetch('https://erp.example.com/orders');
  });
}
