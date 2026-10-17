# unhandled-deadlock-serialization

**Serializable or Repeatable Read isolation, or multi-row locking, with no retry for the transactions the database will abort.**

Severity: medium · Detected by: scanner (static) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

```php
// locks taken in request order: A->B in one request, B->A in another
DB::transaction(function () use ($fromId, $toId) {
    $a = Account::lockForUpdate()->find($fromId);
    $b = Account::lockForUpdate()->find($toId);
});
```

```python
engine = create_engine(DSN, isolation_level="SERIALIZABLE")
```

## Why it hurts

PostgreSQL says applications using Repeatable Read or Serializable "must be prepared to retry transactions due to serialization failures" (SQLSTATE 40001), from the start. A deadlock (40P01) aborts one of the transactions, and the docs say it is hard to predict which. InnoDB rolls back the whole transaction on deadlock and its docs say to retry. Agents set Serializable to "fix" a race and add no retry, so under concurrency users get 500s instead of the race. A single-request test never conflicts.

## Fix

Retry the whole transaction a few times with a small jittered backoff. Take locks in a consistent order.

```ts
for (let i = 0; ; i++) {
  try { return await prisma.$transaction(fn, { isolationLevel: 'Serializable' }); }
  catch (e: any) { if (i >= 3 || e?.code !== 'P2034') throw e; await sleep(Math.random() * 50 * 2 ** i); }
}
```

```php
DB::transaction(function () use ($fromId, $toId) {
    Account::whereIn('id', [$fromId, $toId])->orderBy('id')->lockForUpdate()->get();   // one order for everyone
    // ...
}, attempts: 3);   // Laravel retries the closure on deadlock
```

## When it's fine

- A shared retry wrapper in another file handles it. The scanner checks only the current file, so say so.
- A single-row lock, which can't deadlock with itself.

## How backslop detects it

It flags `isolationLevel: ...Serializable|RepeatableRead`, `isolation_level="SERIALIZABLE"`, `ISOLATION_LEVEL_SERIALIZABLE`, Sequelize `ISOLATION_LEVELS.SERIALIZABLE` and SQL `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE|REPEATABLE READ`. It skips the whole file if it mentions any of `40001`, `40P01`, `P2034`, `serialization failure`, `deadlock`, `retry`, `attempts` or `backoff`.

Review: two or more `lockForUpdate()` / `FOR UPDATE` reads on different ids with no ordering.

Prisma's `P2034` code is from memory, not from a fetched page. Check it against the Prisma error reference for your version.

## Sources

- PostgreSQL docs, Transaction Isolation (retry on serialization failure): https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL docs, Explicit Locking, "Deadlocks" (consistent lock order): https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL docs, Error Codes (40001, 40P01): https://www.postgresql.org/docs/current/errcodes-appendix.html
- MySQL Reference Manual, InnoDB Error Handling: https://dev.mysql.com/doc/refman/8.0/en/innodb-error-handling.html
- Laravel docs, Database, "Database Transactions" (the `attempts` argument retries on deadlock): https://laravel.com/docs/12.x/database#database-transactions
