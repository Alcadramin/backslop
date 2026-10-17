# missing-transaction-multi-write

**Several writes that must succeed together, with no transaction around them (or one that was just removed).**

Severity: high · Detected by: scanner (diff, removed wrapper) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$from->decrement('balance', $amt);
$to->increment('balance', $amt);
Transfer::create([...]);
```

```ts
const order = await prisma.order.create({ data });
await prisma.item.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
```

```python
def transfer(src, dst, amount):     # @transaction.atomic removed
    src.balance -= amount
    src.save()
    dst.balance += amount
    dst.save()
```

Agents remove the wrapper while "simplifying", or to fix a transaction timeout, or because a nested transaction caused an error. Then they report the bug as gone.

## Why it hurts

An exception, timeout or deploy between two writes leaves half the change behind: money debited and never credited, an order with no lines, a user with no profile. Kleppmann treats atomicity, all writes or none, as the core promise of a transaction. Laravel's `DB::transaction` closure rolls back on any exception and rethrows, so nobody has to remember the rollback. Tests only exercise the path where every write succeeds.

## Fix

```php
DB::transaction(function () use ($from, $to, $amt) {
    $from->decrement('balance', $amt);
    $to->increment('balance', $amt);
    Transfer::create([...]);
});
```

```ts
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data });
  await tx.item.createMany({ data: items.map((i) => ({ ...i, orderId: order.id })) });
});
```

If the transaction was removed because it got slow or timed out, fix the cause (a network call inside it, an unbatched mass update). Removing it doesn't fix that. See `network-call-in-transaction` and `oversized-transaction`.

## When it's fine

- The writes are deliberately independent, such as an audit row that must survive a failed operation.
- A framework-level transaction already covers them (Django `ATOMIC_REQUESTS`, a caller's transaction). Say where.

## How backslop detects it

Diff mode. A removed line opens a transaction:
- `DB::transaction(`, `->transaction(`, `$transaction(`, `.transaction(`
- `beginTransaction(`
- `transaction.atomic` / `@atomic`, `.begin()`
- `query('BEGIN')`

It reports one when no transaction opener is added back within 15 lines, the function still has two or more writes outside any transaction, and nothing else in the function starts one. Renaming the wrapper (`DB::transaction` to `$this->db->transaction`) isn't flagged, and neither is deleting the code.

Review the static case: any function with two or more related writes and no transaction. Domain words such as `balance`, `ledger`, `payment`, `order`, `stock` and `inventory` raise the stakes.

## Sources

- Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 7 "Transactions" (atomicity).
- Laravel docs, Database, "Database Transactions": https://laravel.com/docs/12.x/database#database-transactions
- Laravel docs, Query Builder, "Pessimistic Locking" (transfer example inside a transaction): https://laravel.com/docs/12.x/queries#pessimistic-locking
- Prisma docs, Transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
