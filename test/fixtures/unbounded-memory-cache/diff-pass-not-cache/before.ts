export const pool = new Pool({ max: 10, idleTimeoutMillis: 30_000 });
export const limiter = { max: 100, windowMs: 60_000 };
