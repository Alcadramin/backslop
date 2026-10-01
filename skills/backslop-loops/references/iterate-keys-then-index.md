# iterate-keys-then-index

**Looping over a collection's keys only to read each value back by key.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
foreach (array_keys($prices) as $sku) {
    $total += $prices[$sku];
}
```

```ts
Object.keys(prices).forEach((k) => { total += prices[k]; });
for (const sku of Object.keys(prices)) console.log(sku, prices[sku]);
```

```python
for i in range(len(items)):
    total += items[i].price
for sku in prices.keys():
    print(sku, prices[sku])
```

## Why it hurts

In PHP and JS, this builds a separate array of keys and then does an extra lookup per item, when the language gives you key and value together. The cost is small. It's mostly noise, but it reliably shows code translated from another language or written without knowing `foreach ($a as $k => $v)`. Check the rest of the change for the same habit.

## Fix

```php
foreach ($prices as $sku => $price) {
    $total += $price;
}
// or just: $total = array_sum($prices);
```

```ts
for (const [sku, price] of Object.entries(prices)) total += price;
```

```python
for item in items:              # or: for i, item in enumerate(items)
    total += item.price
for sku, price in prices.items():
    print(sku, price)
```

## When it's fine

- The body removes or replaces entries (`unset($a[$k])`, `$a[$k] = ...`). Iterating a snapshot of the keys is the safe way to do that.
- Index loops that look at neighbours (`$a[$i + 1]`, `items[i - 1]`).

## How backslop detects it

The scanner flags:
- `foreach (array_keys($a) as $k)`
- `Object.keys(o).forEach(k => ...)` and `for (const k of Object.keys(o))`
- `for i in range(len(xs))` and `for k in d.keys()`

It flags them only when the body reads `a[k]`. It skips bodies that:
- assign to `a[k]` or unset it
- reassign `a`
- index neighbours (`a[k + 1]`)

Tests are skipped.

## Sources

- pylint `consider-using-enumerate` (C0200): https://pylint.readthedocs.io/en/stable/user_guide/messages/convention/consider-using-enumerate.html
- pylint `consider-using-dict-items` (C0206; Ruff `PLC0206`).
- eslint-plugin-unicorn `no-for-each`; Biome `noForEach`.
