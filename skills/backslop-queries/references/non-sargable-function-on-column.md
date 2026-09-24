# non-sargable-function-on-column

**A function or arithmetic wrapped around an indexed column in WHERE, so the index can't be used.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
Order::whereRaw('DATE(created_at) = ?', [$day])->get();
Order::whereDate('created_at', $day)->get();                      // DATE(created_at) = ? on MySQL
User::whereRaw('LOWER(email) = ?', [strtolower($e)])->first();
```

```ts
knex('orders').whereRaw('DATE(created_at) = ?', [day]);
```

```python
Order.objects.filter(created_at__date=day)
```

## Why it hurts

A plain index stores the raw column values. `DATE(created_at)`, `LOWER(email)`, `YEAR(paid_at)` or `price * 1.2 > 100` asks about a computed value the index does not hold, so the planner reads every row. Winand's summary: functions are black boxes to the database, and databases do not solve equations. The query works the same on a small test table, so nothing fails until the table is large.

## Fix

Leave the column bare and move the computation to the other side. For dates, use a half-open range.

```php
Order::where('created_at', '>=', $day->startOfDay())
     ->where('created_at', '<', $day->copy()->addDay()->startOfDay())
     ->get();
```

```ts
knex('orders').where('created_at', '>=', start).andWhere('created_at', '<', end);
```

```python
Order.objects.filter(created_at__gte=start, created_at__lt=start + timedelta(days=1))
```

When you really need the expression (case-insensitive email), store a normalized value or create a matching expression index:

```sql
CREATE INDEX users_lower_email ON users (lower(email));
```

## When it's fine

- An expression index or generated-column index that matches the expression exactly.
- Tiny tables.
- Functions on the parameter side: `created_at >= NOW() - INTERVAL 7 DAY` keeps the column bare.
- MySQL columns with a case-insensitive collation, where `LOWER()` was never needed.

## How backslop detects it

Review only. Whether an expression index exists, and what SQL an ORM helper compiles to, depends on the database. Look for:

- In SQL strings and `whereRaw` / `orderByRaw` / `knex.raw` / `RawSQL(`: `DATE(`, `YEAR(`, `LOWER(`, `UPPER(`, `TRIM(`, `CAST(`, `COALESCE(`, `DATE_FORMAT(` applied to a column in `WHERE`.
- Laravel `whereDate` / `whereYear` / `whereMonth` / `whereDay` / `whereTime`.
- Django `__date`, `__year`, `__lower` lookups. Django turns some lookups (such as `__year`) into ranges on some backends. This was not verified per backend, so print `str(qs.query)` and check.
- Migrations: an expression index (`CREATE INDEX ... (lower(`, `->rawIndex(`) that matches.

## Sources

- Use The Index, Luke, "Functions": https://use-the-index-luke.com/sql/where-clause/functions
- Use The Index, Luke, "Obfuscated Conditions", "Dates" and "Math": https://use-the-index-luke.com/sql/where-clause/obfuscation/dates , https://use-the-index-luke.com/sql/where-clause/obfuscation/math
- PostgreSQL docs, "Indexes on Expressions": https://www.postgresql.org/docs/current/indexes-expressional.html
- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern" (factoring a computation out of the predicate): https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
