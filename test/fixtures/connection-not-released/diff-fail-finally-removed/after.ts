import { Pool } from 'pg';
const pool = new Pool();

export async function getUser(id: string) {
  const client = await pool.connect();
  const r = (await client.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  return r;
}

export async function both(id: string) {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT 1');
    client.release();
    return r;
  } catch (e) {
    client.release();
    throw e;
  }
}

export async function simple(id: string) {
  return pool.query('SELECT * FROM users WHERE id = $1', [id]); // checks out and releases for you
}

export async function handOff() {
  const client = await pool.connect();
  return client; // the caller releases it
}
