import { Pool } from 'pg';

export const pool = new Pool({ max: Number(process.env.DB_POOL_MAX ?? 10), connectionTimeoutMillis: 2_000 });

export const retry = { max: 100, backoffMs: 50 };
export const limiter = rateLimit({ windowMs: 60_000, max: 500 });
