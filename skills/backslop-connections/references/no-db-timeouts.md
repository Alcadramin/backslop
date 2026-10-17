# no-db-timeouts

**No statement, lock, idle-in-transaction or pool-acquire timeout, or one that was just removed.**

Severity: medium · Detected by: scanner (diff, removed setting) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
// before: statement_timeout: 5_000, connectionTimeoutMillis: 2_000
const pool = new Pool({ connectionString, max: 10 });
```

```python
engine = create_engine(DATABASE_URL, pool_size=10)   # pool_timeout and statement_timeout removed
```

A report query hits the timeout, so the agent deletes the timeout for every query.

## Why it hurts

PostgreSQL defaults `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout` to 0, which turns them off. One runaway query or one forgotten open transaction can then hold locks and a connection forever. PostgreSQL describes `idle_in_transaction_session_timeout` as the guard against idle sessions that hold locks and block vacuum. Without an acquire timeout on the pool, requests wait indefinitely for a connection instead of failing fast. Nygard's Timeouts and Fail Fast patterns apply to the database as much as to HTTP.

## Fix

```ts
const pool = new Pool({
  connectionString, max: 10,
  connectionTimeoutMillis: 2_000,
  statement_timeout: 5_000,
  idle_in_transaction_session_timeout: 10_000,
});
```

```sql
-- role-scoped, instead of postgresql.conf
ALTER ROLE app_user SET statement_timeout = '5s';
ALTER ROLE app_user SET lock_timeout = '2s';
ALTER ROLE app_user SET idle_in_transaction_session_timeout = '30s';
```

If one query really needs longer, raise its timeout alone: `SET LOCAL statement_timeout = '60s'` inside that transaction.

## When it's fine

The timeouts are set on the server, the role or the managed provider, where the scanner can't see them. Say where in your reply.

## How backslop detects it

Diff mode. A removed line that sets one of these:
- PostgreSQL: `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `query_timeout`
- pools: `connectionTimeoutMillis`, `acquireTimeout(Millis)`, `pool_timeout`
- MongoDB: `socketTimeoutMS`, `serverSelectionTimeoutMS`
- PHP: `PDO::ATTR_TIMEOUT`, `MYSQLI_OPT_CONNECT_TIMEOUT`

It reports one when no timeout setting is added back within 15 lines and database configuration is still nearby. Changing the value isn't flagged, and neither is deleting the whole config. HTTP timeouts belong to the io-resilience rules.

Review: a new pool or database config with none of these settings.

The node-postgres option names `statement_timeout`, `idle_in_transaction_session_timeout` and `connectionTimeoutMillis` are from memory of the client options, not a fetched page.

## Sources

- PostgreSQL docs, Client Connection Defaults: https://www.postgresql.org/docs/current/runtime-config-client.html
- node-postgres docs, Pooling: https://node-postgres.com/features/pooling
- Michael Nygard, *Release It!* (2nd ed.), ch. 5 "Stability Patterns", "Timeouts" and "Fail Fast".
