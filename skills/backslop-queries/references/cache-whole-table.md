# cache-whole-table

**Caching an entire table, or an unbounded query result, to make lookups "fast".**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The unbounded query is still there. It just moved behind a cache.

```php
$products = Cache::rememberForever('products', fn () => Product::all());
$p = $products->firstWhere('sku', $sku);
```

```ts
// module-level in-memory cache of a whole table
let allUsers: User[] | null = null;
export async function getUser(id: number) {
  allUsers ??= await prisma.user.findMany();
  return allUsers.find(u => u.id === id);
}
```

```python
@functools.lru_cache
def all_products():
    return list(Product.objects.all())
```

## Why it hurts

Every cache miss loads and serializes the whole table. Every hit deserializes all of it to use one row. The payload grows with the table. In-process caches hold a copy per worker, and each instance keeps its own snapshot, so instances disagree after a write. Azure's caching guidance says in-memory caches suit modest amounts of static data, are limited by the machine's memory, and go stale across instances. Long-lived entries can also fill the cache and force evictions. In tests the table is small and the cache looks like a clean win.

## Fix

Cache the specific lookup, with a TTL.

```php
$p = Cache::remember("product:sku:$sku", now()->addMinutes(10),
    fn () => Product::where('sku', $sku)->first());
```

```ts
export const getUser = (id: number) => prisma.user.findUnique({ where: { id } });
```

```python
def product_by_sku(sku):
    return Product.objects.filter(sku=sku).first()
```

## When it's fine

- Small, rarely changing reference tables (countries, currencies), with a TTL or explicit invalidation.
- Caching a computed number or aggregate rather than the rows.

## How backslop detects it

Review only. Whether a table is small and static is a data question. Look for:

- `Cache::remember(` / `rememberForever(` / `forever(` / `cache()->remember(` wrapping `::all()` or a `->get()` with no `where` or `limit`.
- Python `@lru_cache` / `@cache` on a function returning `.objects.all()`, or `cache.set(..., list(Model.objects.all()))`.
- JS: a module-scope variable filled from `findMany(` with no `take`, then searched with `.find(` / `.filter(`.
- A diff that replaces a keyed lookup with a cached `all()`.

## Sources

- Microsoft Azure Architecture Center, "Caching guidance": https://learn.microsoft.com/en-us/azure/architecture/best-practices/caching
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns", "Unbounded Result Sets" (the query behind the cache is still unbounded).
- Laravel docs, Eloquent "Chunking Results" (memory warning for `all`/`get` on large tables): https://laravel.com/docs/12.x/eloquent#chunking-results
