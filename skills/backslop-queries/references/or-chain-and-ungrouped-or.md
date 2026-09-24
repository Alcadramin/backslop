# or-chain-and-ungrouped-or

**An ungrouped `orWhere` that leaks other tenants' rows, and OR chains that should be `IN` or `UNION`.**

Severity: high (ungrouped OR next to a tenant or owner filter), medium (OR chains) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The dangerous one is a correctness bug, not a speed problem:

```php
// compiles to: tenant_id = ? AND title LIKE ? OR is_public = 1
// so every public document of every tenant comes back
Doc::where('tenant_id', $t)->where('title', 'like', "$s%")->orWhere('is_public', true)->get();
```

The slow ones:

```php
// one OR term per id
$q = Product::query();
foreach ($ids as $id) { $q->orWhere('id', $id); }
```

```ts
prisma.product.findMany({ where: { OR: ids.map(id => ({ id })) } });
```

```python
q = Q()
for i in ids:
    q |= Q(id=i)
```

## Why it hurts

- **Ungrouped OR.** `AND` binds tighter than `OR`. A top-level `orWhere` after a tenant, user or owner filter makes the filter optional for the OR branch. Rows from other tenants come back. Tests with one tenant pass. Laravel's docs say to always group `orWhere` calls in a closure, because global scopes can change the result otherwise.
- **Same-column OR chains.** MySQL treats `id = 1 OR id = 2 ...` like an `IN()` list in its range optimizer, so the main cost is a huge statement and planner work per term. `IN` / `whereIn` is clearer and binds better.
- **OR across different columns** (`a = ? OR b = ?`) can't be served by one ordinary index. The planner needs an index merge or bitmap OR, or it scans. A `UNION` of two indexed queries is the usual rewrite.

## Fix

```php
// group the OR so the tenant filter applies to both branches
Doc::where('tenant_id', $t)
   ->where(fn ($q) => $q->where('title', 'like', "$s%")->orWhere('is_public', true))
   ->get();

Product::whereIn('id', $ids)->get();
```

```ts
prisma.product.findMany({ where: { id: { in: ids } } });
```

```python
Product.objects.filter(id__in=ids)
```

## When it's fine

- A deliberate top-level OR with no other conditions on the query.
- A short OR list of two or three literals.

## How backslop detects it

Review only. Whether a column scopes access (tenant, owner, team) is a schema and intent question. Look for:

- A chain with `where('tenant_id'|'team_id'|'company_id'|'account_id'|'owner_id'|'user_id'|'org_id', ...)` followed by a top-level `->orWhere(` that is not inside a closure. Treat this as an authorization bug.
- Raw SQL mixing `AND` and `OR` without parentheses after a `*_id = ?` filter. Django: `filter(user=...) | Model.objects.filter(...)`.
- `orWhere(` inside a loop, `OR: ids.map(`, `q |= Q(` inside a `for`.

## Sources

- Laravel docs, Query Builder, "Or Where Clauses" and "Logical Grouping": https://laravel.com/docs/12.x/queries#logical-grouping
- MySQL 8.4 docs, "Range Optimization": https://dev.mysql.com/doc/refman/8.4/en/range-optimization.html
