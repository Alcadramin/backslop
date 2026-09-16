export function a() { return 1; }

export async function legacyList() {
  return prisma.order.findMany({ take: 50 });
}

export function b() { return 2; }
