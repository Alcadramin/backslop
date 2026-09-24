# huge-in-list

**A `whereIn` / `IN (...)` with thousands of ids taken from another unbounded query.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

A join done in the application, in two steps.

```php
$ids = User::where('country', 'TR')->pluck('id');     // unbounded
$orders = Order::whereIn('user_id', $ids)->get();     // tens of thousands of bindings
```

```ts
const users = await prisma.user.findMany({ where: { country: 'TR' } });
const orders = await prisma.order.findMany({ where: { userId: { in: users.map(u => u.id) } } });
```

```python
Order.objects.filter(user_id__in=list(User.objects.filter(country="TR").values_list("id", flat=True)))
```

## Why it hurts

The first query has no bound, and the second statement carries every id it returned as a bound value. MySQL's range optimizer has a memory cap (`range_optimizer_max_mem_size`). When a large `IN` list goes over it, MySQL gives up range access, possibly falling back to a full scan, and issues a warning. Laravel documents `whereIntegerInRaw` because large binding arrays use a lot of memory. A subquery or join lets the database do the whole thing in one step.

## Fix

Let the database join.

```php
$orders = Order::whereIn('user_id', User::select('id')->where('country', 'TR'))->paginate(50);  // subquery
$orders = Order::whereHas('user', fn ($q) => $q->where('country', 'TR'))->paginate(50);
```

```ts
prisma.order.findMany({ where: { user: { country: 'TR' } }, take: 50 });
```

```python
# a queryset (not a list) passed to __in becomes a subquery
Order.objects.filter(user__in=User.objects.filter(country="TR"))[:50]
```

## When it's fine

- Id lists from user input or from an already bounded page. 20 to 500 ids is fine, and it is the right fix for N+1 (see [n-plus-one-query-in-loop](n-plus-one-query-in-loop.md)).
- Integer ids in Laravel with `whereIntegerInRaw` when you really have a large, known list.

## How backslop detects it

Review only. The size of the list depends on the data. Look for:

- `$ids = ...->pluck('id')` (or `->modelKeys()`) followed later by `whereIn('...', $ids)`.
- Python `__in=list(...values_list(` over `.objects.`.
- JS `in: rows.map(r => r.id)` where `rows` came from a `findMany` with no `take`.
- A diff that replaces `whereHas(` / a subquery / a `join(` with `pluck('id')` plus `whereIn(`.

## Sources

- MySQL 8.4 docs, "Range Optimization", "Limiting Memory Use for Range Optimization": https://dev.mysql.com/doc/refman/8.4/en/range-optimization.html
- Laravel docs, Query Builder, "Additional Where Clauses" (`whereIntegerInRaw`): https://laravel.com/docs/12.x/queries#additional-where-clauses
