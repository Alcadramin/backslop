# distinct-hides-bad-join

**Adding `DISTINCT` to hide the duplicate rows a one-to-many join produced.**

Severity: low (medium when combined with SUM/COUNT) · Detected by: review only · Languages: PHP, Python

## What it looks like

An agent sees duplicate users in a list and "fixes" it with `distinct()`.

```php
User::join('orders', 'orders.user_id', '=', 'users.id')
    ->where('orders.total', '>', 100)
    ->select('users.*')
    ->distinct()
    ->get();
```

```python
User.objects.filter(order__total__gt=100).distinct()
```

## Why it hurts

A join to a to-many table produces one row per child. `DISTINCT` hides that, but the database still builds every duplicate and then sorts or hashes the whole set to remove them. Aggregates computed over the multiplied rows stay wrong: `SUM(orders.total)` joined to `order_items` counts each order once per item. A semi-join (`EXISTS`, `whereHas`) or aggregating in a subquery first never produces the duplicates.

## Fix

```php
User::whereHas('orders', fn ($q) => $q->where('total', '>', 100))->paginate(50);
```

```sql
SELECT u.id, u.name FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 100);
```

```python
from django.db.models import Exists, OuterRef
User.objects.filter(Exists(Order.objects.filter(user=OuterRef("pk"), total__gt=100)))
```

## When it's fine

- You really want distinct values from the data: `SELECT DISTINCT country FROM users`.
- A small result where the duplicate work does not matter and no aggregate runs over the joined rows.

## How backslop detects it

Review only. Telling a join fix from an honest distinct needs intent. Look for:

- SQL strings with both `SELECT DISTINCT` and `JOIN`.
- Laravel chains with `->join(` / `->leftJoin(` and `->distinct()`.
- Django `.filter(` across a relation (`a__b=`) followed by `.distinct()`.
- A diff that adds `distinct()` / `DISTINCT` to a query that already has a join. Ask where the duplicates came from.

## Sources

- Laravel docs, Eloquent Relationships, "Querying Relationship Existence" (`whereHas`, `has`): https://laravel.com/docs/12.x/eloquent-relationships#querying-relationship-existence
- Bill Karwin, *SQL Antipatterns*, "Spaghetti Query" chapter (joins that produce unintended Cartesian products). The chapter name is from the publisher's table of contents. Whether it discusses DISTINCT specifically was not confirmed.
