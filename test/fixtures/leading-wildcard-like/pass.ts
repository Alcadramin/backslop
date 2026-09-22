export const search = (q: string) => prisma.product.findMany({ where: { name: { startsWith: q } }, take: 20 });
export const ok = (xs: string[], q: string) => xs.filter((x) => x.includes(q));
export const schema = { contains: { type: 'string' } };
