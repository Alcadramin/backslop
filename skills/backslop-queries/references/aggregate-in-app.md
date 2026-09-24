# aggregate-in-app

**Summing, averaging, grouping or reducing rows in app code instead of in SQL.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$revenue = Order::where('paid', true)->get()->sum('total');
$byKind  = Item::query()->get(['kind', 'outcome'])->groupBy('kind')->map->count();
```

```ts
const total = (await prisma.order.findMany({ where: { paid: true } })).reduce((s, o) => s + o.total, 0);
```

```python
total = sum(o.total for o in Order.objects.filter(paid=True))
```

## Why it hurts

The app loads every row to produce one number or a small table. Azure's Extraneous Fetching example pulled over 280 KB from the database for a 14-byte JSON response. After the sum moved into SQL, the transfer dropped to about 53 bytes and throughput rose by more than 10x. Grouping in code also builds a hash map of the whole result in app memory. The cost grows with the table, while tests run on a handful of rows.

## Fix

```php
$revenue = Order::where('paid', true)->sum('total');
$byKind  = Item::selectRaw('kind, COUNT(*) AS n')->groupBy('kind')->pluck('n', 'kind');
$posts   = Post::withCount('comments')->withSum('orders', 'total')->paginate(20);
```

```ts
const { _sum } = await prisma.order.aggregate({ where: { paid: true }, _sum: { total: true } });
const perStatus = await prisma.order.groupBy({ by: ['status'], _count: true });
```

```python
from django.db.models import Count, Sum
total = Order.objects.filter(paid=True).aggregate(s=Sum("total"))["s"]
per_status = Order.objects.values("status").annotate(n=Count("id"))
```

## When it's fine

- The rows are already loaded for display on the same request (the sum of the 20 items on screen).
- Each row needs app logic before it can be summed, such as currency conversion with live rates, on a bounded set.
- `groupBy()` only buckets rows for rendering and nothing is counted or summed.

## How backslop detects it

A static rule. It reports:
- PHP: `->get()` or `Model::all()` followed directly by `->sum('col')`, `avg`, `average`, `max`, `min`, `median`, `countBy`, `reduce`, or `groupBy('col')` when the statement then counts or sums the groups (`->map->count()`, `->count()`, `->map(fn ... ->count())`).
- JS/TS: `.reduce(` on `(await x.findMany(...))` with no `take`, or on a variable holding a `findMany()` with no `where`, `take`, `cursor` or `skip`.
- Python: `sum(...)`, `max(...)` or `min(...)` over a generator or list comprehension that iterates an unsliced `Model.objects...` chain.

It skips:
- closure arguments (`->sum(fn ($o) => ...)`),
- queries that already aggregate in SQL (`COUNT(`/`SUM(` in a `selectRaw`, a query-level `groupBy`/`having`),
- `groupBy()` with no count or sum after it,
- chains bounded by `limit`/`take`/`find`, and test and migration files.

## Sources

- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern" (`AggregateOnClientAsync` vs `AggregateOnDatabaseAsync` and the measured telemetry): https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
- Laravel docs, Eloquent, "Retrieving Aggregates": https://laravel.com/docs/12.x/eloquent#retrieving-aggregates
- Laravel docs, Eloquent Relationships, "Aggregating Related Models": https://laravel.com/docs/12.x/eloquent-relationships#aggregating-related-models
- Django docs, "Database access optimization" (do database work in the database, `annotate()`, aggregation): https://docs.djangoproject.com/en/5.2/topics/db/optimization/
