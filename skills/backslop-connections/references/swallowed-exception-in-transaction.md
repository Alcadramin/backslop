# swallowed-exception-in-transaction

**A database error caught inside the transaction body and not rethrown.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
DB::transaction(function () use ($cart) {
    $order = Order::create([...]);
    try {
        foreach ($cart->items as $i) $order->items()->create($i);
    } catch (\Throwable $e) {
        Log::error($e);          // the order commits with missing items
    }
});
```

```ts
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data });
  try { await tx.item.createMany({ data: items }); } catch (e) { console.error(e); }
});
```

```python
with transaction.atomic():
    order = Order.objects.create(**data)
    try:
        Item.objects.bulk_create(items)
    except IntegrityError:
        log.exception("items")
```

## Why it hurts

A closure transaction decides between commit and rollback by whether the body throws. Laravel's `DB::transaction` rolls back on an exception and rethrows it. Catch the exception inside and the framework sees a normal return. What happens next depends on the stack:

- MySQL/InnoDB: a duplicate-key error or a lock wait timeout rolls back only the failing statement. The writes before it commit, without the rest.
- PostgreSQL: the transaction is aborted after any error. Every later statement fails with `in_failed_sql_transaction` (25P02), far from the real cause.
- Django: after a `DatabaseError` the transaction is broken. Django rolls back at the end of `atomic()`, and any query before that raises `TransactionManagementError`. The docs say: "Avoid catching exceptions inside atomic!"

Agents add these catches to make a failing step "not crash". The test passes, and the data is now half-written or the error surfaces somewhere else.

## Fix

Let it propagate. Handle it outside the transaction. If part of the work may fail on purpose, give that part its own savepoint.

```php
try {
    DB::transaction(function () use ($cart) { /* all writes */ });
} catch (QueryException $e) {
    report($e);
    return back()->withErrors('Could not place the order');
}
```

```python
with transaction.atomic():
    order = Order.objects.create(**data)
    try:
        with transaction.atomic():          # savepoint: only this part rolls back
            Item.objects.bulk_create(items)
    except IntegrityError:
        ...
```

## When it's fine

- The catch rethrows (`throw $e`, `raise`, a wrapped exception) or rolls back explicitly.
- The `try` wraps a nested transaction, which is a savepoint (nested `DB::transaction`, nested `atomic()`, `begin_nested()`).
- The exception isn't a database error: `DoesNotExist`, `ModelNotFoundException`, `JsonException`, a domain exception. No SQL failed, so the transaction is still healthy.

## How backslop detects it

Inside a transaction body, it finds a `catch` / `except` block where all of these hold:
- the matching `try` does a database write or query
- the catch doesn't contain `throw`, `raise`, `abort(`, a rollback or `set_rollback(`
- the try doesn't wrap a nested transaction or savepoint
- it catches broadly or catches a database error: PHP `Exception` / `Throwable` / `QueryException` / `PDOException` / `UniqueConstraintViolationException`, Python bare `except:` / `Exception` / `IntegrityError` / `DatabaseError` / `OperationalError` / `SQLAlchemyError`. JS catches everything.

In diff mode it also reports an existing catch when a line inside that try/catch was changed (a removed `throw`, for example) or when the transaction around it is new.

On saleor it flagged one site: `except DatabaseError` around `media.save(update_fields=...)` inside `atomic()`. That is the case Django's docs warn about, though the error there is raised by Django, not by a failed SQL statement.

## Sources

- Laravel docs, Database, "Database Transactions" (rollback and rethrow on exception): https://laravel.com/docs/12.x/database#database-transactions
- Django docs, Database transactions, "Avoid catching exceptions inside atomic!": https://docs.djangoproject.com/en/5.2/topics/db/transactions/
- MySQL Reference Manual, InnoDB Error Handling (statement vs transaction rollback): https://dev.mysql.com/doc/refman/8.0/en/innodb-error-handling.html
- PostgreSQL docs, Error Codes (25P02 `in_failed_sql_transaction`): https://www.postgresql.org/docs/current/errcodes-appendix.html
