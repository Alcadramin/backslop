export async function place(data: OrderInput) {
  try {
    return await prisma.$transaction(async (tx) => tx.order.create({ data }));
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function withRethrow(data: OrderInput) {
  return prisma.$transaction(async (tx) => {
    try {
      return await tx.order.create({ data });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError();
      throw e;
    }
  });
}

export async function parseOnly(raw: string) {
  return prisma.$transaction(async (tx) => {
    let meta = null;
    try {
      meta = JSON.parse(raw);
    } catch {
      meta = null;
    }
    return tx.order.create({ data: { meta } });
  });
}
