import { Pool } from 'pg';
import knex from 'knex';

// "fix" for pool timeouts under load
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 200 }); // expect: pool-oversized

export const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL + '?connection_limit=100', // expect: pool-oversized
  pool: { min: 2, max: 100 }, // expect: pool-oversized
});
