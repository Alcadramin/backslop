# session-state-through-pooler

**Session-level state (`SET`, advisory locks, `LISTEN`, prepared statements, temp tables) used through a transaction-mode pooler or a PHP persistent connection.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$pdo = new PDO($dsn, $u, $p, [PDO::ATTR_PERSISTENT => true]);
$pdo->exec("SELECT pg_advisory_lock(42)");   // session-level: survives rollback, and through a pooler it's someone else's session
```

```ts
// through PgBouncer in transaction mode
await pool.query("SET statement_timeout = '5s'");
await pool.query('SELECT ...');               // may run on a different server connection
```

## Why it hurts

PgBouncer in transaction mode hands the server connection back after every transaction. Its docs list these as not working in that mode:
- `SET` / `RESET`
- `LISTEN`
- `WITH HOLD` cursors
- SQL `PREPARE`
- session temp tables
- session-level advisory locks

So a `SET search_path` or `pg_advisory_lock()` can apply to another client's session, or vanish. Session-level advisory locks also ignore transactions: a lock taken in a transaction that rolls back is still held.

PHP persistent connections can carry an uncommitted transaction or table locks from a crashed script into the next request on that worker. They also hold one connection per worker, even while idle.

## Fix

```php
DB::transaction(function () {
    DB::select('SELECT pg_advisory_xact_lock(?)', [42]);   // released at COMMIT/ROLLBACK
    // ...
});
```

```ts
await client.query('BEGIN');
await client.query("SET LOCAL statement_timeout = '5s'");   // scoped to this transaction
// ...
await client.query('COMMIT');
```

## When it's fine

Session-mode pooling or a direct connection. A dedicated long-lived `LISTEN` process on a direct connection.

## How backslop detects it

Review only. Look for these, and weigh them higher if the repo mentions `pgbouncer`, `:6543` or `pool_mode = transaction`:
- `pg_advisory_lock(` without `_xact_`
- `LISTEN x`
- a bare `SET` (not `SET LOCAL`) in query strings
- `PREPARE x AS`
- `PDO::ATTR_PERSISTENT => true`, `pconnect(`

## Sources

- PgBouncer, Features (what works in each pooling mode): https://www.pgbouncer.org/features.html
- PostgreSQL docs, Explicit Locking, "Advisory Locks" (session vs transaction level): https://www.postgresql.org/docs/current/explicit-locking.html
- PHP manual, Persistent Database Connections: https://www.php.net/manual/en/features.persistent-connections.php
