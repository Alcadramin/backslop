import { Pool } from 'pg';
const pool = new Pool();

export async function transfer(from: string, to: string, amt: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amt, from]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function reads() {
  // pool.query('BEGIN') would be wrong here
  await pool.query('SELECT begin_date FROM events');
  await pool.query("BEGINNING_BALANCE", []);
  await knex.transaction(async (trx) => trx('a').insert({}));
}
