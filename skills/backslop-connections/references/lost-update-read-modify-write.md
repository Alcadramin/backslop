# lost-update-read-modify-write

**A read-modify-write with no row lock, atomic update or version check, often because a lock was just removed.**

Severity: high · Detected by: scanner (diff, removed lock) + review · Languages: PHP, TypeScript/JavaScript, Python

The query-shape version (doing arithmetic in app code instead of one `UPDATE`) is covered by [read-modify-write](../../backslop-queries/references/read-modify-write.md) in backslop-queries. This page covers the concurrency side: locks, versions and what a transaction doesn't protect.

## What it looks like

The agent "simplifies" a query and drops the lock:

```php
// before
$p = Product::whereKey($id)->lockForUpdate()->firstOrFail();
// after
$p = Product::findOrFail($id);
$p->stock = $p->stock - $qty;
$p->save();
```

```python
# before: Product.objects.select_for_update().get(pk=pid)
p = Product.objects.get(pk=pid)
p.stock -= qty
p.save(update_fields=["stock"])
```

```ts
// before: 'SELECT stock FROM products WHERE id = $1 FOR UPDATE'
const { rows } = await client.query('SELECT stock FROM products WHERE id = $1', [id]);
await client.query('UPDATE products SET stock = $1 WHERE id = $2', [rows[0].stock - qty, id]);
```

## Why it hurts

Two requests read `stock = 5`. Both compute 4 and both write 4, so one sale disappears. Kleppmann calls this the lost update problem. His fixes are atomic writes, explicit locks (`SELECT ... FOR UPDATE`) and compare-and-set. A transaction on its own doesn't help: PostgreSQL defaults to Read Committed, where two plain SELECTs don't block each other. Single-user tests can't show it.

## Fix

Pick one:

```php
// atomic, with the guard in the WHERE
$ok = Product::whereKey($id)->where('stock', '>=', $qty)->decrement('stock', $qty);
if (! $ok) throw new OutOfStock();

// when the logic needs the row: lock it in the same transaction
DB::transaction(function () use ($id, $qty) {
    $p = Product::whereKey($id)->lockForUpdate()->firstOrFail();
    // ...checks...
    $p->decrement('stock', $qty);
});
```

```ts
// optimistic: write only if nobody else did
const r = await prisma.doc.updateMany({ where: { id, version: d.version }, data: { body, version: { increment: 1 } } });
if (r.count === 0) throw new ConflictError();
```

```python
with transaction.atomic():
    p = Product.objects.select_for_update().get(pk=pid)
    ...
```

## When it's fine

- One writer by design: a setting only its owner edits, or a queue worker with concurrency 1 per record.
- Last write wins is acceptable for the field, such as `last_seen_at`.
- The lock moved to an outer query in the same transaction. Check that it really did.

## How backslop detects it

Diff mode. It looks at removed lines holding a lock:
- `lockForUpdate()`, `sharedLock()`
- `select_for_update()`, `with_for_update()`
- `forUpdate()` / `forShare()` and `.for('update')` in Knex and Kysely
- TypeORM `lock: { mode`
- SQL `FOR UPDATE`, `FOR SHARE`, `LOCK IN SHARE MODE`

It reports one when no lock is added back within 15 lines and a query is still there. Comments are ignored, and deleting the whole query isn't flagged. Reformatting a chain onto several lines isn't flagged.

Review the rest: a read followed by a write computed from it, with none of lock / atomic update / version.

## Sources

- Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 7 "Transactions", "Preventing Lost Updates" (section names confirmed through secondary notes, not the book text).
- PostgreSQL docs, Transaction Isolation (Read Committed default): https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL docs, Explicit Locking (`FOR UPDATE`): https://www.postgresql.org/docs/current/explicit-locking.html
- Laravel docs, Query Builder, "Pessimistic Locking": https://laravel.com/docs/12.x/queries#pessimistic-locking
- Prisma docs, Transactions (optimistic concurrency control with a version field): https://www.prisma.io/docs/orm/prisma-client/queries/transactions
