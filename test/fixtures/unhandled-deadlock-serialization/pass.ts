export async function book(seatId: string, userId: string) {
  for (let i = 0; ; i++) {
    try {
      return await prisma.$transaction(
        async (tx) => tx.seat.update({ where: { id: seatId }, data: { userId } }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (i >= 3 || e?.code !== 'P2034') throw e;
      await sleep(Math.random() * 50 * 2 ** i);
    }
  }
}
