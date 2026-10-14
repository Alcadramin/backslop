import { Pool } from 'pg';
const pool = new Pool();

export async function getUser(id: string) {
  const client = await pool.connect(); // expect: connection-not-released
  const r = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  client.release();
  return r.rows[0];
}

export async function mysqlWay(id: string) {
  const conn = await this.pool.getConnection(); // expect: connection-not-released
  const [rows] = await conn.query('SELECT 1');
  conn.release();
  return rows;
}
