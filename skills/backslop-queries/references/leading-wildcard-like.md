# leading-wildcard-like

**`LIKE '%term%'` used as search: no ordinary index can serve a leading wildcard.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
Product::where('name', 'like', "%{$q}%")->orWhere('description', 'like', "%{$q}%")->get();
Contact::whereLike('email', "%{$q}%")->get();
```

```ts
prisma.product.findMany({ where: { name: { contains: q, mode: 'insensitive' } } });   // LIKE '%q%'
knex('products').whereILike('name', `%${q}%`);
```

```python
Product.objects.filter(name__icontains=q)
```

## Why it hurts

A B-tree index can only narrow a search by the characters before the first wildcard. `'%term'` and `'%term%'` leave nothing to narrow, so the database scans every row on every search, often on every keystroke. With bind parameters, PostgreSQL plans for a possible leading wildcard and skips the index. Karwin calls this the "Poor Man's Search Engine": pattern matching standing in for full-text search. It is fast on a dev table and slow on the real one.

## Fix

```php
// full-text index on name, description (MySQL / PostgreSQL)
Product::whereFullText(['name', 'description'], $q)->limit(20)->get();
// prefix search can use a normal index
Product::where('sku', 'like', $q.'%')->limit(20)->get();
```

```python
from django.contrib.postgres.search import SearchVector
Product.objects.annotate(s=SearchVector("name", "description")).filter(s=q)[:20]
```

On PostgreSQL, a `pg_trgm` GIN or GiST index also serves `%term%`. Prisma: use full-text search on supported databases, or a trigram index added in a raw migration.

## When it's fine

- The table is small, or another indexed condition already narrows it to a few rows (one user's contacts). The LIKE then only filters those.
- PostgreSQL with a `pg_trgm` index on the column. Check the migrations for `gin_trgm_ops`.
- Admin filters that run rarely.

backslop can't see table size or trigram indexes, so the rule is low severity: it points at the line, and you decide.

## How backslop detects it

A static rule. It reports:
- SQL text with `LIKE '%`, `LIKE CONCAT('%'`, or `LIKE '%' ||`,
- a `'like'` / `'ilike'` operator argument followed by a value that starts with `%` (Laravel, knex),
- `whereLike` / `orWhereLike` / `whereILike` with a `%...` value, and TypeORM `Like('%...')`,
- SQLAlchemy `.like("%...")` / `.ilike(f"%...")`,
- Django `__icontains=`, `__endswith=`, `__iendswith=`,
- Prisma `contains:` / `endsWith:` inside a `where` or a query call.

It does not report Django `__contains`, which on JSON and array fields means containment, not LIKE. It skips tests and migrations.

## Sources

- Use The Index, Luke, "LIKE Performance Tuning": https://use-the-index-luke.com/sql/where-clause/searching-for-ranges/like-performance-tuning
- Bill Karwin, *SQL Antipatterns*, "Poor Man's Search Engine" chapter (chapter name from the publisher's table of contents).
- Laravel docs, Query Builder, "Full Text Where Clauses": https://laravel.com/docs/12.x/queries#full-text-where-clauses
