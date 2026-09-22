export const search = (q: string) =>
  prisma.product.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 20 }); // expect: leading-wildcard-like
export const search2 = (q: string) => knex('products').whereILike('name', `%${q}%`); // expect: leading-wildcard-like
