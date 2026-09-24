# fake-streaming

**"Streaming" APIs that still buffer the whole result, or that silently drop eager loading.**

Severity: medium · Detected by: review only · Languages: PHP, Python

## What it looks like

An agent fixes an out-of-memory error by switching to a cursor or iterator, and the fix does less than it seems.

```php
// MySQL buffers the result in PDO, and cursor() cannot eager load: N+1 is back
foreach (Order::cursor() as $o) {
    echo $o->customer->email;
}
```

```python
# SQLAlchemy: yield_per, then .all() pulls everything into one list anyway
rows = session.execute(select(Order).execution_options(yield_per=1000)).scalars().all()
```

```python
# Django on MySQL: iterator() does not stream; the driver loads the whole result
for o in Order.objects.all().iterator():
    ...
```

## Why it hurts

The memory problem is still there, now with a comment saying it was fixed.
- Laravel's docs say `cursor()` can still run out of memory because PHP's PDO MySQL driver buffers results, and that `cursor()` cannot eager load relations.
- Django's docs say MySQL does not stream with `iterator()`. They also say `prefetch_related` only applies to `iterator()` when you pass `chunk_size`.
- In SQLAlchemy, `yield_per` does not work with joined eager loading of collections or with `.unique()`, and calling `.all()` on the result undoes it.
- Doctrine says you can't iterate a query that fetch-joins a collection.

## Fix

Use batched loading that keeps eager loading and really bounds memory.

```php
Order::with('customer:id,email')->lazyById(1000)->each(function ($o) {
    // ...
});
```

```python
for part in session.execute(select(Order).execution_options(yield_per=1000)).scalars().partitions():
    ...

for o in Order.objects.select_related("customer").iterator(chunk_size=2000):
    ...
```

## When it's fine

- PostgreSQL drivers with server-side cursors, which really stream (Django uses them for `iterator()` on PostgreSQL and Oracle).
- Small result sets, where none of this matters.
- `cursor()` over rows whose relations are never touched.

## How backslop detects it

Review only. Whether it streams depends on the database driver, and the N+1 half depends on which relations the loop touches. Look for:

- `->cursor()` in a statement that also has `->with(`, or whose loop body reads relations.
- `yield_per` followed by `.all()` or `.unique()`.
- Django `.iterator(` with `prefetch_related(` and no `chunk_size=`.
- Doctrine `->toIterable()` on a query with `JOIN FETCH` of a collection.

## Sources

- Laravel docs, Eloquent, "Cursors": https://laravel.com/docs/12.x/eloquent#cursors
- Django QuerySet reference, `iterator()`: https://docs.djangoproject.com/en/5.2/ref/models/querysets/#iterator
- Doctrine ORM docs, "Batch Processing", "Iterating results": https://www.doctrine-project.org/projects/doctrine-orm/en/3.6/reference/batch-processing.html
- SQLAlchemy 2.0, ORM API features, "Fetching Large Result Sets with Yield Per": https://docs.sqlalchemy.org/en/20/orm/queryguide/api.html
