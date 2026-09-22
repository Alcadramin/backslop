export async function find(email: string, id: number) {
  await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`); // expect: string-built-sql
  await knex.raw(`SELECT * FROM users WHERE id = ${id}`); // expect: string-built-sql
  await pool.query("SELECT * FROM users WHERE email = '" + email + "'"); // expect: string-built-sql
}
