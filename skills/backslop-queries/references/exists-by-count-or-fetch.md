# exists-by-count-or-fetch

**Checking whether a row exists by counting every match or by loading them all.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
if (Order::where('user_id', $id)->get()->isNotEmpty()) { ... }
if (Order::where('user_id', $id)->get()->count() > 0) { ... }
$isAdmin = $user->roles()->get()->contains('name', 'admin');
```

```ts
if ((await prisma.order.findMany({ where: { userId } })).length > 0) { ... }
```

```python
if Order.objects.filter(user_id=uid): ...
if Order.objects.filter(user_id=uid).count() > 0: ...
```

## Why it hurts

A count makes the database count every match. A fetch loads every match into memory. An `EXISTS` or `LIMIT 1` check can stop at the first matching index entry. On a large match set that is the difference between a range scan and a single lookup. Each call is cheap on small tables, which is why the severity is low. It adds up on a hot path.

## Fix

```php
if (Order::where('user_id', $id)->exists()) { ... }
if ($user->roles()->where('name', 'admin')->exists()) { ... }
```

```ts
if (await prisma.order.findFirst({ where: { userId }, select: { id: true } })) { ... }
```

```python
if Order.objects.filter(user_id=uid).exists(): ...
```

## When it's fine

- You display the count too. Then one `count()` is the right call.
- You use the rows on the next line. Django's docs say to evaluate the queryset once and reuse its cache rather than call `exists()` and then iterate.
- The check needs PHP logic on each row (`->contains(fn ($x) => $x->countryCode() === ...)`). backslop does not flag closures.

## How backslop detects it

A static rule. It reports:
- PHP: `->get()->isEmpty()`, `->get()->isNotEmpty()`, `->get()->contains('col', ...)`, `->get()->doesntContain(...)`, and `->get()->count()` compared with 0 or 1.
- JS/TS: `(await x.findMany(...)).length` compared with 0 (no `take`), `.some(` / `.includes(` on such a result, and the same on a variable holding a whole-table `findMany()`.
- Python: `if Model.objects.filter(...):` and `Model.objects....count() > 0` (or `== 0`, `!= 0`, `>= 1`) on a lazy chain.

It skips calls with a closure or callable argument, fetches bounded by `limit`/`take`/`find`, in-memory collections, and test and migration files.

## Sources

- Laravel docs, Query Builder, "Determining if Records Exist": https://laravel.com/docs/12.x/queries#determining-if-records-exist
- Django docs, "Use QuerySet.exists()": https://docs.djangoproject.com/en/5.2/topics/db/optimization/#use-queryset-exists
- Django docs, "Don't overuse contains(), count(), and exists()": https://docs.djangoproject.com/en/5.2/topics/db/optimization/
