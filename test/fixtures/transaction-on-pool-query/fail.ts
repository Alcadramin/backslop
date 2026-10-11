import { Pool } from 'pg';
const pool = new Pool();

export async function transfer(from: string, to: string, amt: number) {
  await pool.query('BEGIN'); // expect: transaction-on-pool-query
  await pool.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amt, from]);
  await pool.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amt, to]);
  await pool.query('COMMIT'); // expect: transaction-on-pool-query
}

export async function knexWay() {
  await knex.raw(`START TRANSACTION`); // expect: transaction-on-pool-query
  await this.dbPool.query("rollback"); // expect: transaction-on-pool-query
}
