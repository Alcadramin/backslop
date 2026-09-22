export const pick = () => prisma.$queryRaw`SELECT * FROM products ORDER BY RANDOM() LIMIT 1`; // expect: order-by-random
