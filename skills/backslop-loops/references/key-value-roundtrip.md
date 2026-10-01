# key-value-roundtrip

**`array_keys` / `array_values` / `array_combine` / `array_flip` calls that undo each other, or a hand-rolled `array_column`.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript (Python: see below)

## What it looks like

This is the "complex for no reason" pattern. Each call is valid on its own, but chained together they do nothing, or they do what one built-in call already does.

```php
$ids    = array_values(array_keys($byId));                          // array_keys already returns a list
$same   = array_combine(array_keys($byId), array_values($byId));    // that's just $byId
$emails = array_map(fn ($r) => $r['email'], $rows);                 // that's array_column($rows, 'email')
$byKey  = array_combine(array_column($rows, 'id'), $rows);          // that's array_column($rows, null, 'id')
$names  = array_combine(array_column($rows, 'id'), array_column($rows, 'name'));
$parts  = array_values(explode(',', $csv));                         // explode already returns a list
$unique = array_flip(array_flip($tags));                            // a dedupe in disguise
$n      = count(array_keys($byId));                                 // count($byId)
$has    = in_array('x', array_values($tags), true);                 // in_array ignores keys
$keys   = array_unique(array_keys($byId));                          // keys are unique already
```

```ts
const values = Object.keys(prices).map((k) => prices[k]);     // Object.values(prices)
const ids = Object.entries(users).map(([id]) => id);         // Object.keys(users)
const copy = Object.fromEntries(Object.entries(prices));     // { ...prices }, or just prices
```

## Why it hurts

Every extra call allocates a new array and copies the data. Inside a hot path or over a large result set, that adds up. The bigger cost is the reader's: they have to work out what each stage returns and then notice that it changes nothing. It also shows that the author didn't know what the inner call returns, which is worth checking for in the rest of the change.

## Fix

Use the one call that does the job:

```php
$ids    = array_keys($byId);
$emails = array_column($rows, 'email');
$byKey  = array_column($rows, null, 'id');          // id => whole row
$names  = array_column($rows, 'name', 'id');        // id => name
$unique = array_unique($tags);                      // or keep array_flip($tags) as a set and use isset()
$n      = count($byId);
```

If you need a list from something that keeps keys (`array_filter`, `array_map` over a keyed array, `array_column` with an index key), `array_values` is correct. Keep it there.

## When it's fine

- `array_values(array_filter(...))` and `array_values(array_map(...))`: both inner calls keep keys, and JSON needs a list.
- `array_values(array_column($rows, null, 'id'))` dedupes rows by id (the last one wins). That's deliberate.
- `array_flip(array_flip($a))` is a known fast dedupe for int/string values. It's fine if a comment says so. `array_unique` reads better.
- `array_column` reads array keys and public object properties. For objects whose values come from getters, `array_map` is the right tool. The scanner only flags `array_map` that plucks an array key (`$r['email']`).
- Python is left to Ruff: `SIM118` covers `key in d.keys()`, and `PERF101` covers an unneeded `list()` around something you only iterate.

## How backslop detects it

Exact shapes, matched on code with comments and strings stripped:
- `array_values(array_keys|array_values|range|explode|str_split|preg_split|array_column(x, 'k')(...))`
- `array_combine(array_keys($a), array_values($a))` and `array_combine(array_keys($a), $a)`
- `array_combine(array_column($r, 'k'), $r)` and `array_combine(array_column($r, 'k'), array_column($r, 'v'))`
- `array_flip(array_flip(...))`
- `array_map(fn ($r) => $r['k'], $rows)` and the `function ($r) { return $r['k']; }` form, with exactly one array
- `in_array(x, array_values(...))`, `count(array_keys($a))`, `count(array_values($a))`, `array_unique(array_keys($a))`
- JS: `Object.keys(o).map(k => o[k])`, `Object.entries(o).map(([, v]) => v)`, `Object.entries(o).map(([k]) => k)`, `Object.fromEntries(Object.entries(o))`

The two-argument `array_keys($a, $value)` is a search, not a round-trip, so it isn't flagged. Tests are skipped.

## Sources

- PHP manual, `array_column` (`column_key` can be `null` to return whole rows; `index_key` sets the key): https://www.php.net/manual/en/function.array-column.php
- Rector `SimplifyInArrayValuesRector`: https://getrector.com/rule-detail/simplify-in-array-values-rector
- Rector `SimplifyArraySearchRector`.
- Ruff `SIM118`, `PERF101`.
