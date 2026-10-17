# connection-held-during-slow-work

**A pooled connection kept checked out while the code does slow work that isn't database work.**

Severity: medium · Detected by: review only · Languages: TypeScript/JavaScript, Python, PHP

## What it looks like

```ts
const c = await pool.connect();
try {
  const { rows } = await c.query('SELECT * FROM docs WHERE id=$1', [id]);
  const summary = await llm.summarize(rows[0].body);      // seconds; the connection sits idle but taken
  await c.query('UPDATE docs SET summary=$1 WHERE id=$2', [summary, id]);
} finally { c.release(); }
```

```python
with engine.begin() as conn:
    row = conn.execute(select(Doc).where(Doc.id == id)).one()
    r = requests.post(OCR_URL, data=row.blob, timeout=30)
    conn.execute(update(Doc).values(text=r.text))
```

## Why it hurts

A pool of 10 serves 10 units of work at a time. If each one holds its connection across a 2-second HTTP call, image resize or LLM call, throughput tops out at 5 requests per second, however idle the database is. Requests queue on the pool. Nygard calls this Blocked Threads: work waits on a resource held by unrelated work. HikariCP's point is that a pool should be sized for database concurrency, not for request concurrency.

## Fix

```ts
const { rows } = await pool.query('SELECT body FROM docs WHERE id=$1', [id]);
const summary = await llm.summarize(rows[0].body);
await pool.query('UPDATE docs SET summary=$1 WHERE id=$2', [summary, id]);
```

Read, release, do the slow work, then write with a fresh checkout. If the write must match what was read, use a version check on the write (see `lost-update-read-modify-write`), not a held connection.

## When it's fine

The slow work is short and bounded (milliseconds), or the process is a single-connection batch job with nothing else waiting on the pool.

## How backslop detects it

Review only. Between `connect()` / `with pool.connection()` / `with engine.begin()` and the release, look for:
- `fetch(`, `axios`, `requests.`, `httpx.`
- `sleep`
- LLM SDK calls
- `sharp(`, `ffmpeg`

If the block is a transaction, `network-call-in-transaction` flags most of these.

## Sources

- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns", "Blocked Threads" and "Integration Points".
- HikariCP wiki, About Pool Sizing: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
- node-postgres docs, Pooling: https://node-postgres.com/features/pooling
