import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 5_000),
});
