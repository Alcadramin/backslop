# connection-not-released

**A checked-out connection released on the happy path only, so every error leaks one from the pool.**

Severity: high · Detected by: scanner (static + diff) · Languages: TypeScript/JavaScript, Python (PHP in review)

## What it looks like

```ts
const client = await pool.connect();
const r = await client.query('SELECT ...');
client.release();             // skipped if the query throws
```

```python
conn = pool.getconn()
cur = conn.cursor(); cur.execute(q)
pool.putconn(conn)            # skipped on any exception
```

```php
$lock = Cache::lock('report', 60); $lock->get(); work(); $lock->release();   // lock kept if work() throws
```

## Why it hurts

node-postgres says you must always return a checked-out client to the pool, or the app leaks clients until the pool is empty for good. The leak only happens on the error path, so the demo works. In production, once enough requests have thrown, the pool is empty. Every later request waits for a connection until it times out, and the database looks idle. Nygard calls this Blocked Threads.

## Fix

```ts
const client = await pool.connect();
try {
  return await client.query('SELECT ...');
} finally {
  client.release();
}
// no transaction needed? pool.query() checks out and releases for you
```

```python
with pool.connection() as conn:
    conn.execute(q)

with requests.get(url, stream=True, timeout=10) as r:   # streamed responses hold the connection too
    for chunk in r.iter_content(65536): ...
```

```php
Cache::lock('report', 60)->get(fn () => work());
```

## When it's fine

- The connection is returned to a caller that releases it, or handed to a wrapper that does (`withClient(async c => ...)`).
- It's released on the error path explicitly too (`catch (e) { client.release(); throw e; }`).
- `pool.query()`, which releases on its own.

## How backslop detects it

Static, for JS/TS and Python. It looks for `const c = await x.connect()` / `x.getConnection()` and `conn = pool.getconn()` / `pool.acquire()`. If the function releases that variable (`c.release()`, `pool.putconn(conn)`) but never inside a `finally` or a `catch`, it's flagged.

Diff mode also catches the regression: a removed `finally` or `release()` / `putconn()` line, where the function still checks out the connection and no longer releases it on every path. Returning the connection to the caller isn't flagged.

## Sources

- node-postgres docs, Pooling ("you must always return the client to the pool"): https://node-postgres.com/features/pooling
- Requests docs, Advanced Usage, "Body Content Workflow" (with `stream=True` the connection isn't released until the body is consumed or closed): https://requests.readthedocs.io/en/latest/user/advanced/
- Laravel docs, Cache, "Atomic Locks": https://laravel.com/docs/12.x/cache
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns", "Blocked Threads".
