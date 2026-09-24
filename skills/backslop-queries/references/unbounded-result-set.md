# unbounded-result-set

**A query with no upper bound, or one whose bound an "optimization" removed.**

Severity: high · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The classic agent move: asked to make an endpoint faster, it deletes `paginate()` so there is "one query instead of many", loads everything, and filters in memory.

```php
// before
$orders = Order::where('status', 'open')->orderBy('id')->paginate(50);

// after the agent's "optimization"
$orders = Order::all()->where('status', 'open');   // every order in the table, filtered in PHP
```

```ts
// Prisma: `take` silently dropped
const orders = await prisma.order.findMany({ where: { status: 'open' } });
```

```python
# Django: the slice is gone, list() forces the whole queryset into memory
orders = list(Order.objects.filter(status="open"))
```

## Why it hurts

A query with no bound returns as many rows as the table holds. With 50 rows in development it looks fine. With five million rows in production, every row is sent over the wire, turned into an object and kept in memory. Latency and memory grow with table size until the request times out or the worker runs out of memory, and the database stays busy the whole time. Michael Nygard lists this as a stability antipattern: the code assumes the data will stay small.

The tests usually pass, because test databases are small. That's why the agent reports success.

## Fix

Keep the bound. Choose it by what the code is for:

```php
// API page: bounded and stable
return OrderResource::collection(
    Order::where('status', 'open')->orderBy('id')->cursorPaginate(50)
);

// Job that must touch every row: batches, constant memory
Order::where('status', 'open')->chunkById(500, function ($orders) {
    foreach ($orders as $order) { /* ... */ }
});
```

```ts
const orders = await prisma.order.findMany({
  where: { status: 'open' },
  orderBy: { id: 'asc' },
  take: 50,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
});
```

```python
orders = Order.objects.filter(status="open").order_by("id")[:50]        # page
for o in Order.objects.filter(status="open").iterator(chunk_size=2000):  # batch job
    ...
```

If the goal was fewer queries, solve that directly: eager-load the relations (see `n-plus-one-lazy-relation`) or push the filter into SQL (see `filter-sort-in-app`). Neither needs the bound removed.

## When it's fine

- The table is small and fixed by design: a lookup table of countries or currencies, or a settings table. Say so in a comment.
- A one-off admin export that streams rows (`lazyById()`, `cursor()`, `iterator()`) and writes them out as it goes.
- The bound moved somewhere else: an outer query, a `whereIn` over a bounded id list, or a repository method. Check that it really did.

## How backslop detects it

In diff mode the scanner looks at every removed line that holds a bound:
- Laravel/ORM calls: `paginate`, `cursorPaginate`, `chunk`, `chunkById`, `lazy`, `cursor`, `limit`, `take`, `forPage`
- SQL clauses: `LIMIT n`, `FETCH FIRST n`, `TOP n`
- Prisma options: `take:`
- Knex and SQLAlchemy calls: `.limit()`, `.offset()`, `.iterator()`, `yield_per`
- Django queryset slices

It reports a finding when:
- no bound is added back within 15 lines, and
- a query is still there. Deleting the whole query isn't flagged.

Comments are ignored. Swapping one bound for another (`paginate` → `cursorPaginate`) isn't flagged.

## Sources

- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns", "Unbounded Result Sets".
- Laravel docs, Eloquent "Chunking Results" (loading tens of thousands of models with `all`/`get` can run out of memory): https://laravel.com/docs/12.x/eloquent#chunking-results
- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern": https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
- Django docs, "Database access optimization", `iterator()`: https://docs.djangoproject.com/en/5.2/topics/db/optimization/
- Prisma docs, pagination: https://www.prisma.io/docs/orm/prisma-client/queries/pagination
