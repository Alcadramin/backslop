# order-by-random

**`ORDER BY RAND()` to pick random rows: the whole table is sorted to keep a few.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$p = Product::inRandomOrder()->first();
$q = DB::select('SELECT id FROM products ORDER BY RAND() LIMIT 1');
$r = Product::all()->random();       // worse: loads the whole table (see fetch-all-to-take-one)
```

```ts
await prisma.$queryRaw`SELECT * FROM products ORDER BY RANDOM() LIMIT 1`;
```

```python
Product.objects.order_by("?").first()
session.scalars(select(Product).order_by(func.random()).limit(1))
```

## Why it hurts

`ORDER BY RAND() LIMIT 1` generates a random value for every row and sorts the whole table to keep one. No index helps, so the cost grows with the table on every call. Django's docs note that `order_by('?')` may be expensive and slow, depending on the backend. On a 200-row dev table it is instant.

## Fix

```php
// dense-enough integer ids; retry on gaps
$max = Product::max('id');
$p = Product::where('id', '>=', random_int(1, $max))->orderBy('id')->first();
```

```sql
-- PostgreSQL, large tables: sample a fraction of pages
SELECT * FROM products TABLESAMPLE SYSTEM (1) LIMIT 5;
```

Other options: pick a random offset and seek to it, or keep a precomputed pool of candidate ids. Karwin's "Random Selection" chapter covers these alternatives.

## When it's fine

- The table is small and fixed by design: a few hundred quiz questions or banner images. Say so in a comment.
- Admin tools and one-off scripts.
- Seeders and factories, which backslop skips.

## How backslop detects it

A static rule. It reports:
- Laravel `->inRandomOrder(` and `::inRandomOrder(`,
- SQL text with `ORDER BY RAND()`, `RANDOM()`, `NEWID()` or `DBMS_RANDOM.VALUE`,
- Django `order_by("?")` and SQLAlchemy `order_by(func.random())`.

It skips tests, migrations, seeders and factories. It cannot see table size, so the severity is medium.

## Sources

- Bill Karwin, *SQL Antipatterns*, "Random Selection" chapter (chapter name from the publisher's table of contents).
- Django QuerySet reference, `order_by('?')`: https://docs.djangoproject.com/en/5.2/ref/models/querysets/#order-by
- Laravel docs, Query Builder, ordering (`inRandomOrder`): https://laravel.com/docs/12.x/queries#ordering
