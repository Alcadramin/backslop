# accumulate-by-copy-in-loop

**Growing a collection by copying everything collected so far on every iteration: O(n²) time and garbage to build one list.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$rows = [];
foreach ($pages as $p) {
    $rows = array_merge($rows, $api->fetch($p));      // copies $rows every time
}

foreach ($offers as $offer) {
    $currencies = [...$currencies, ...array_keys($offer['prices'])];
}

$byId = array_reduce($rows, fn ($carry, $r) => array_merge($carry, [$r['id'] => $r]), []);
```

```ts
const byId = items.reduce((acc, x) => ({ ...acc, [x.id]: x }), {});   // copies acc per item
let all: Item[] = [];
for (const g of groups) all = [...all, ...g.items];
```

```python
rows = []
for p in pages:
    rows = rows + api.fetch(p)          # a new list every time
flat = sum(list_of_lists, [])           # same thing, one line
```

## Why it hurts

Each assignment builds a new array and copies every element already collected. Item 1 is copied n times, item 2 n−1 times, and so on: about n²/2 copies in total. 10,000 items is 50 million element copies, plus the garbage from every short-lived intermediate array.

In PHP, `array_merge` can reuse its first argument only when nothing else references it (refcount 1, `zend_may_modify_arg_in_place()` in php-src). `$all = array_merge($all, ...)` still holds `$all`, so it allocates and copies every time. Python's docs say repeated concatenation of immutable sequences has "a quadratic runtime cost in the total sequence length".

The output is correct, and with ten items it's instant. That's why it passes review.

## Fix

Append in place, or collect the pieces and merge once:

```php
$chunks = [];
foreach ($pages as $p) {
    $chunks[] = $api->fetch($p);
}
$rows = array_merge(...$chunks);     // PHP 7.4+: also fine when $chunks is empty

foreach ($rows as $r) { $byId[$r['id']] = $r; }   // or array_column($rows, null, 'id')
```

```ts
const byId = Object.fromEntries(items.map((x) => [x.id, x]));
const all = groups.flatMap((g) => g.items);
```

```python
rows = []
for p in pages:
    rows.extend(api.fetch(p))
flat = list(itertools.chain.from_iterable(list_of_lists))
```

## When it's fine

- The loop runs a few times by design, like merging three config files. Say so if the scanner flags it.
- Immutable updates (Redux, React state) need a fresh object once per update. That's one copy per event, not one copy per element. The scanner only looks inside loops and reduce callbacks.
- An object spread whose keys don't change (`totals = { ...totals, count: totals.count + 1 }`) copies a constant-size object. That's linear, and the scanner skips it.

## How backslop detects it

Inside a loop body:
- PHP: `$x = array_merge($x, ...)` (also `array_merge_recursive` and `array_replace`, with `$x` in any argument position), and `$x = [...$x, ...]`.
- JS/TS: `x = [...x, ...]`, `x = x.concat(...)`, and `x = { ...x, ... }` when the literal adds a computed key (`[k]: v`) or spreads another object.
- Python: `x = x + ...` where `x` starts as a list or tuple.

Anywhere:
- reduce callbacks (`.reduce`, `array_reduce`, Laravel `->reduce`) that return `[...acc]`, `{ ...acc, [k]: v }`, `acc.concat()`, `Object.assign({}, acc)` or `array_merge($carry, ...)`
- Python `sum(lists, [])`

Skipped:
- loops that reset the accumulator, such as a batch flushed and set back to `[]`, because the copy stays bounded
- tests, fixtures, seeders and migrations

Severity is high because this is O(n²) whenever the loop runs over data, and the linear fix costs nothing.

## Sources

- php-src `ext/standard/array.c`, `php_array_merge_wrapper()`, and `Zend/zend_API.h`, `zend_may_modify_arg_in_place()`: https://github.com/php/php-src/blob/master/ext/standard/array.c
- PHP Inspections (EA Extended), "Slow array function used in loop": https://github.com/kalessil/phpinspectionsea/blob/master/docs/performance.md
- PHP manual, `array_merge` (callable with no arguments since 7.4): https://www.php.net/manual/en/function.array-merge.php
- Biome `noAccumulatingSpread`: https://biomejs.dev/linter/rules/no-accumulating-spread/
- Oxc `no-accumulating-spread` (covers loops too): https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-accumulating-spread.html
- Python docs, sequence types, note 6: https://docs.python.org/3/library/stdtypes.html
- Ruff `RUF017` quadratic-list-summation.
