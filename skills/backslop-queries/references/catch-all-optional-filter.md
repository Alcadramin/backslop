# catch-all-optional-filter

**One static query that handles every optional filter with `(:x IS NULL OR col = :x)`.**

Severity: low · Detected by: review only · Languages: PHP, TypeScript/JavaScript

## What it looks like

```php
DB::select(
    'SELECT * FROM orders WHERE (:s IS NULL OR status = :s) AND (:c IS NULL OR customer_id = :c)',
    ['s' => $status, 'c' => $customerId]
);
```

```sql
SELECT * FROM orders WHERE COALESCE(:status, status) = status;
```

## Why it hurts

The database plans the statement once for every combination of filters, including "all filters off". That generic plan is built for the worst case and is often a full table scan, even when every filtered column has an index. Winand calls this "the smartest way to make SQL slow". It works on a small dataset and slows down as the table grows.

## Fix

Build the query with only the active conditions, still using bind parameters.

```php
Order::query()
    ->when($status, fn ($q, $s) => $q->where('status', $s))
    ->when($customer, fn ($q, $c) => $q->where('customer_id', $c))
    ->paginate(50);
```

```ts
const q = knex('orders');
if (status) q.where({ status });
if (customerId) q.where({ customer_id: customerId });
```

## When it's fine

- Reports that run rarely.
- Databases and options that re-plan per execution with the actual values (for example `OPTION (RECOMPILE)` in SQL Server).

## How backslop detects it

Review only. The cost depends on the planner and the data. Look for SQL strings containing:

- `(:x IS NULL OR col = :x)` or `(? IS NULL OR col = ?)`, and the reversed `(col = :x OR :x IS NULL)`.
- `COALESCE(:x, col) = col`.

## Sources

- Use The Index, Luke, "Smart Logic": https://use-the-index-luke.com/sql/where-clause/obfuscation/smart-logic
- Laravel docs, Query Builder, "Conditional Clauses" (`when()`): https://laravel.com/docs/12.x/queries#conditional-clauses
