export async function book(seatId: string, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const seat = await tx.seat.findUniqueOrThrow({ where: { id: seatId } });
      return tx.seat.update({ where: { id: seat.id }, data: { userId } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }, // expect: unhandled-deadlock-serialization
  );
}
