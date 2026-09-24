# read-modify-write

**Reading a value, changing it in code and writing it back, instead of one atomic UPDATE.**

Severity: high (money, stock, quotas), medium (view counters) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$product = Product::find($id);
$product->stock = $product->stock - $qty;
$product->save();

$post->update(['views' => $post->views + 1]);
```

```ts
const p = await prisma.product.findUnique({ where: { id } });
await prisma.product.update({ where: { id }, data: { stock: p!.stock - qty } });
```

```python
p = Product.objects.get(pk=pid)
p.stock -= qty
p.save()
```

## Why it hurts

Two requests read the same stock of 5 at the same time. Both write `5 - 1 = 4`. One sale is lost. Kleppmann calls this the lost update problem, and notes that ORMs make the unsafe version easy to write. Nothing fails in a test, because tests run one request at a time. It also costs an extra round trip for the read.

## Fix

Let the database do the arithmetic in one statement. Put the guard in the `WHERE` and check the affected row count.

```php
$affected = Product::whereKey($id)->where('stock', '>=', $qty)->decrement('stock', $qty);
if ($affected === 0) { throw new OutOfStock(); }

$post->increment('views');
```

```ts
const { count } = await prisma.product.updateMany({
  where: { id, stock: { gte: qty } },
  data: { stock: { decrement: qty } },
});
// Knex: await knex('products').where({ id }).andWhere('stock', '>=', qty).decrement('stock', qty);
```

```python
from django.db.models import F
updated = Product.objects.filter(pk=pid, stock__gte=qty).update(stock=F("stock") - qty)
```

## When it's fine

- The read happens inside a transaction that locks the row: `lockForUpdate()`, `select_for_update()` or `SELECT ... FOR UPDATE`. Check that the lock and the write are in the same transaction.
- A single writer by design (one queue worker per record).
- The new value needs logic SQL can't express. Then the fix is a lock or an optimistic version check, not an atomic expression.

## How backslop detects it

Review only. Whether two writers can race depends on how the code is called. Look for:

- `$x->col = $x->col - ...` or `$x->col -= ...` followed by `$x->save()`, and `->update(['col' => $x->col + 1])`.
- Prisma `data: { col: row.col - n }`.
- Python `obj.col -= n` (or `+=`) followed by `obj.save()`, where `obj` came from `.objects.get(` / `.first()` / `session.get(`.
- Column names like `balance`, `stock`, `quantity`, `credits`, `seats`, `inventory`, `points` raise the stakes.
- A diff that removes `increment(` / `decrement(` / `F("` / `{ increment:` / `SET x = x +` and adds a read then assign.

## Sources

- Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 7 "Transactions", "Preventing Lost Updates" (section names confirmed through secondary notes, not the book text).
- Django docs, Query Expressions, "Avoiding race conditions using F()": https://docs.djangoproject.com/en/5.2/ref/models/expressions/#avoiding-race-conditions-using-f
- Prisma Client reference, "Atomic number operations": https://www.prisma.io/docs/orm/reference/prisma-client-reference#atomic-number-operations
- Laravel docs, Query Builder, "Increment and Decrement": https://laravel.com/docs/12.x/queries#increment-and-decrement
