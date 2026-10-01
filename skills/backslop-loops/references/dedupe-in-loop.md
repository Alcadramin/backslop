# dedupe-in-loop

**Running `array_unique` / `new Set` / `set()` over the whole accumulator on every iteration.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$tags = [];
foreach ($rows as $r) {
    $tags = array_unique(array_merge($tags, $r['tags']));   // also accumulate-by-copy-in-loop
}
```

```ts
let tags: string[] = [];
for (const r of rows) tags = [...new Set([...tags, ...r.tags])];
```

```python
tags = []
for r in rows:
    tags = list(set(tags + r.tags))
```

## Why it hurts

Each dedupe walks everything collected so far. With the default `SORT_STRING` flag, php-src's `array_unique` builds a hash table of seen values. With other flags it sorts, which is O(n log n). Doing that once per iteration turns the loop into O(n²) or worse, plus a new array each time.

## Fix

Keep a seen-map and check each new item, or dedupe once at the end:

```php
$seen = [];
foreach ($rows as $r) {
    foreach ($r['tags'] as $t) {
        $seen[$t] = true;
    }
}
$tags = array_keys($seen);
```

```ts
const tags = new Set<string>();
for (const r of rows) for (const t of r.tags) tags.add(t);
```

```python
seen = set()
for r in rows:
    seen.update(r.tags)
```

## When it's fine

- Deduping a per-item list that doesn't grow across iterations (`array_unique($r['tags'])`).
- Deduping once, after the loop.

## How backslop detects it

Inside a loop body, the scanner flags a dedupe whose argument reads the variable being assigned:
- PHP: `$x = array_unique(... $x ...)`
- JS/TS: `x = [...new Set(... x ...)]`, `Array.from(new Set(... x ...))`, `new Set(... x ...)`, `uniq(... x ...)`
- Python: `x = list(set(... x ...))`

It skips:
- variables that are reset inside the loop
- loop variables
- tests, fixtures, seeders and migrations

The manual dedupe with `in_array` (`if (!in_array($v, $seen)) $seen[] = $v;`) is caught by `linear-lookup-in-loop`.

## Sources

- php-src `PHP_FUNCTION(array_unique)` (the `SORT_STRING` branch uses a `seen` HashTable; other flags sort): https://github.com/php/php-src/blob/master/ext/standard/array.c
- PHP manual, `array_unique` (changelog 7.2.0): https://www.php.net/manual/en/function.array-unique.php
