# unstable-order-batching

**LIMIT/OFFSET batches or pages without an ORDER BY on a unique key.**

Severity: high (batch jobs that write), medium (UI pagination) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
// ties at the same created_at can be skipped or repeated between chunks
Event::orderBy('created_at')->chunk(500, $cb);
```

```sql
SELECT id FROM events LIMIT 500 OFFSET :n;   -- no ORDER BY at all
```

```ts
await prisma.event.findMany({ skip, take: 500 });                               // no orderBy
await prisma.event.findMany({ skip, take: 500, orderBy: { createdAt: 'asc' } }); // ties
```

```python
Event.objects.all()[i:i + 500]   # no order_by and no Meta.ordering
```

## Why it hurts

Without `ORDER BY`, SQL promises no row order. Two consecutive `LIMIT ... OFFSET` queries can return overlapping or missing rows, and the result can differ between runs, query plans and replicas. Ordering by a column that is not unique (`created_at`, `status`) has the same problem wherever values tie. A batch job then skips some rows and processes others twice, and still reports success. Pagination shows duplicates. Tests rarely catch it because small tables come back in insertion order.

## Fix

Order by a unique key, or add the primary key as a tiebreaker. Better still for batch jobs, seek by id instead of offset.

```php
Event::orderBy('created_at')->orderBy('id')->chunk(500, $cb);   // or chunkById(500, $cb)
```

```sql
SELECT id FROM events WHERE id > :last ORDER BY id LIMIT 500;
```

```ts
await prisma.event.findMany({
  take: 500,
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  ...(c && { cursor: { id: c }, skip: 1 }),
});
```

```python
Event.objects.order_by("created_at", "id")[i:i + 500]
```

## When it's fine

- `LIMIT 1` used as an existence probe.
- Sampling where order does not matter.
- Laravel Eloquent `chunk()` with no explicit order: the framework adds `ORDER BY <primary key>` itself. The query builder (`DB::table()`) version throws when no order is set.

## How backslop detects it

Review only. Whether the order is unique needs the schema, and Django models can set `Meta.ordering`. Look for:

- SQL strings with `LIMIT` and `OFFSET` but no `ORDER BY`.
- Prisma/Knex calls with `skip`/`offset` and no `orderBy`, or an `orderBy` on a single non-unique column.
- Django slices `[a:b]` with a variable start on a queryset with no `.order_by(`.
- A diff that removes `->orderBy('id')` / `orderBy: { id` / `.order_by("id")` from a batched or paginated query.

## Sources

- PostgreSQL docs, "LIMIT and OFFSET" (use an ORDER BY that constrains the result into a unique order): https://www.postgresql.org/docs/current/queries-limit.html
- Use The Index, Luke, "Paging Through Results" (deterministic sort order, primary key as tiebreaker): https://use-the-index-luke.com/sql/partial-results/fetch-next-page
- Laravel docs, "Cursor Pagination" (requires ordering on a unique column or combination): https://laravel.com/docs/12.x/pagination#cursor-pagination
- Laravel framework source, `enforceOrderBy` in the query builder and the Eloquent builder: https://github.com/laravel/framework/blob/12.x/src/Illuminate/Database/Query/Builder.php , https://github.com/laravel/framework/blob/12.x/src/Illuminate/Database/Eloquent/Builder.php
