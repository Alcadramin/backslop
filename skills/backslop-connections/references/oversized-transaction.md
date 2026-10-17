# oversized-transaction

**One huge transaction or unbatched mass update/delete that holds locks for minutes.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
DB::transaction(function () {
    Order::where('status', 'stale')->get()->each->update(['status' => 'archived']);
});
```

```ts
await prisma.event.deleteMany({ where: { createdAt: { lt: cutoff } } });   // millions of rows, one statement
```

```python
with transaction.atomic():
    for u in User.objects.all():
        u.score = compute(u)
        u.save()
```

## Why it hurts

The transaction holds row locks for the whole run. It blocks writers, grows replication lag, and keeps vacuum from removing dead rows. PostgreSQL says a lock waiter waits indefinitely unless a deadlock is detected, so every request touching those rows hangs behind the batch. Prisma's docs say to keep transactions short. Dev tables have a hundred rows, so it finishes instantly there.

## Fix

Small batches, each in its own short transaction.

```php
Order::where('status', 'stale')->chunkById(500, function ($orders) {
    DB::transaction(fn () => Order::whereIn('id', $orders->pluck('id'))->update(['status' => 'archived']));
});
```

```ts
for (;;) {
  const n = await prisma.$executeRaw`DELETE FROM event WHERE id IN (SELECT id FROM event WHERE created_at < ${cutoff} LIMIT 5000)`;
  if (n === 0) break;
}
```

Use `chunkById`, not `chunk`, when you update the column you filter on. Laravel's docs warn that `chunk` gives inconsistent results there.

## When it's fine

- Small tables.
- Migrations run in a maintenance window.
- One-statement updates that touch few rows by design.

## How backslop detects it

Review only. The cost depends on table size, which a scanner can't see. Look for:
- a transaction body that loads all rows (`->get()`, `::all()`, `findMany()` with no `take`, `.objects.all()`) and then writes per row
- `deleteMany`, `updateMany`, `->delete()` or `->update()` with a date-range `where` and no `limit` / `chunk`
- a diff that removes `chunkById(` or `limit(` from a mass write

## Sources

- PostgreSQL docs, Explicit Locking (indefinite lock waits, keep transactions short): https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL docs, Client Connection Defaults (open transactions block vacuum cleanup): https://www.postgresql.org/docs/current/runtime-config-client.html
- Laravel docs, Eloquent, "Chunking Results" (`chunkById` when updating while iterating): https://laravel.com/docs/12.x/eloquent#chunking-results
- Prisma docs, Transactions ("keep transactions short"): https://www.prisma.io/docs/orm/prisma-client/queries/transactions
