export async function find(email: string, ids: number[], table: string) {
  await prisma.$queryRaw`SELECT id, name FROM users WHERE email = ${email}`;
  await knex.raw('SELECT id, name FROM users WHERE id = ?', [ids[0]]);
  await pool.query(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [ids[0]]);
  await pool.query(`SELECT id FROM users WHERE id = $${ids.length}`, ids);
  await client.query({ query: GET_USER, variables: { email } });
}
