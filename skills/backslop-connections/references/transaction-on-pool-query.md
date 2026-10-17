# transaction-on-pool-query

**`BEGIN` / `COMMIT` sent through `pool.query()`, where every statement can land on a different connection.**

Severity: high · Detected by: scanner (static) · Languages: TypeScript/JavaScript, Python

## What it looks like

```ts
await pool.query('BEGIN');
await pool.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amt, from]);
await pool.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amt, to]);
await pool.query('COMMIT');
```

```python
await pool.execute("BEGIN")       # asyncpg pool
await pool.execute("UPDATE ...")
await pool.execute("COMMIT")
```

## Why it hurts

`pool.query()` checks out a connection, runs one statement and puts the connection back. `BEGIN` opens a transaction on connection A and returns A to the pool with that transaction still open. The `UPDATE`s may run on B and C in autocommit, so there is no atomicity. A stays "idle in transaction" and keeps any locks it took. The next unrelated request that gets A runs inside a stranger's transaction. node-postgres says it plainly: use the same client for every statement in a transaction, and don't use transactions with `pool.query`.

With one test request and a pool that hands back the same idle connection, it seems to work.

## Fix

```ts
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query('UPDATE a ...');
  await c.query('UPDATE b ...');
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
}
```

```python
async with pool.acquire() as conn:
    async with conn.transaction():
        await conn.execute("UPDATE ...")
```

Or use the ORM's transaction helper (`knex.transaction`, `prisma.$transaction`).

## When it's fine

A variable named `pool` that actually holds a single client. That is rare and confusing, so rename it.

## How backslop detects it

`<something>pool.query|raw|execute(` or `knex.raw(` whose first argument is a string starting with `BEGIN`, `START TRANSACTION`, `COMMIT` or `ROLLBACK`. `client.query('BEGIN')` and `SELECT begin_date` are not flagged.

## Sources

- node-postgres docs, Transactions: https://node-postgres.com/features/transactions
- node-postgres docs, Pooling: https://node-postgres.com/features/pooling
- PostgreSQL docs, `idle_in_transaction_session_timeout`: https://www.postgresql.org/docs/current/runtime-config-client.html
