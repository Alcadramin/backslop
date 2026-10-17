# nested-transaction-assumption

**Code that expects an inner "transaction" to commit or roll back independently of the outer one.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
DB::transaction(function () {
    $this->audit->record('attempt');   // internally DB::transaction(...): only a savepoint
    $this->doRiskyWork();              // throws: the audit row rolls back too
});
```

```ts
await client.query('BEGIN');
await inner(client);              // inner() also runs BEGIN ... COMMIT; its COMMIT ends the OUTER transaction
await client.query('UPDATE ...'); // now runs in autocommit
await client.query('COMMIT');
```

## Why it hurts

PostgreSQL has no nested transactions. A `BEGIN` inside an open transaction only raises a warning and changes nothing. The docs point to savepoints for nesting. So an inner helper's "commit" commits nothing, or, with raw SQL, commits the outer work early. An inner "rollback" may roll back everything or nothing, depending on the library. Where libraries do nest, they use savepoints, and the outer commit still decides everything. Agents write a `beginTransaction` in a service method that is also called from inside another transaction, and assume the audit row will survive an outer failure. It won't.

## Fix

- Need the inner write to survive? Write it outside the outer transaction (before, after, in a `finally`) or on a separate connection.
- Need partial rollback inside? Use an explicit savepoint: nested `DB::transaction` (Laravel), nested `atomic()` (Django), `begin_nested()` (SQLAlchemy), `SAVEPOINT` / `RELEASE SAVEPOINT` in raw SQL.
- Helpers that take a client or `tx` should never `BEGIN` or `COMMIT` themselves.

```php
try { DB::transaction(fn () => $this->doRiskyWork()); }
finally { $this->audit->record('attempt'); }
```

## When it's fine

Framework-managed savepoints used on purpose, with the outer commit understood to be final.

## How backslop detects it

Review only. Look for:
- a function that opens a transaction and is called from inside another function's transaction
- a `COMMIT` in a function that receives a client or `tx` parameter
- two transaction starts inside one transaction body

Prisma doesn't support nested `$transaction` calls on the `tx` client. That is from memory, not a fetched page.

## Sources

- PostgreSQL docs, BEGIN (inside a transaction block) and SAVEPOINT: https://www.postgresql.org/docs/current/sql-begin.html and https://www.postgresql.org/docs/current/sql-savepoint.html
