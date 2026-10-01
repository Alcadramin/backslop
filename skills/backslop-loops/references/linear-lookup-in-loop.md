# linear-lookup-in-loop

**A membership test that scans a whole list, run once per item of another loop: O(n·m) where a keyed lookup is O(n + m).**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
foreach ($orders as $o) {
    if (in_array($o['user_id'], $bannedIds, true)) {   // scans $bannedIds for every order
        continue;
    }
    $out[] = $o;
}

// the same thing, on one line
$flagged = array_filter($rows, fn ($r) => in_array($r['id'], $ids, true));

// manual dedupe: the haystack grows, so this one is O(n²) on its own
foreach ($rows as $r) {
    if (!in_array($r['name'], $seen, true)) { $seen[] = $r['name']; }
}
```

```ts
const kept = orders.filter((o) => !bannedIds.includes(o.userId));
```

```python
visible = [o for o in orders if o.user_id not in banned_ids]   # banned_ids is a list
```

## Why it hurts

`in_array`, `array_search`, `Array#includes`/`indexOf` and Python's `x in some_list` compare against every element until they find a match. php-src implements `in_array` and `array_search` with one loop over the whole hash table. Inside a loop over n items, with a haystack of m, that is n·m comparisons. 10,000 orders against 10,000 banned ids is 100 million comparisons. A keyed lookup (`isset`, `Set#has`, a Python `set`/`dict`) costs about the same for any size.

Tests use ten rows, so the quadratic cost never shows up. It shows up when a customer with a big account opens the page.

## Fix

Build the lookup once, before the loop:

```php
$banned = array_flip($bannedIds);          // value => index
foreach ($orders as $o) {
    if (isset($banned[$o['user_id']])) { continue; }
    $out[] = $o;
}

$seen = [];
foreach ($rows as $r) { $seen[$r['name']] = true; }
$names = array_keys($seen);
```

```ts
const banned = new Set(bannedIds);
const kept = orders.filter((o) => !banned.has(o.userId));
```

```python
banned = set(banned_ids)
visible = [o for o in orders if o.user_id not in banned]
```

Two PHP caveats to keep in mind when you suggest `array_flip` + `isset`:
- `array_flip` only works for int and string values.
- Array keys coerce, so `"1"` and `1` become the same key. That is looser than `in_array(..., true)`.

## When it's fine

- The haystack is small and fixed: a handful of statuses or enum values. With opcache on, PHP compiles `in_array($x, ['a', 'b'], true)` against a literal array to the `ZEND_IN_ARRAY` opcode, which is a hash lookup. It isn't a scan. (The research confirmed the opcode and the 2017 optimizer commit. It did not confirm which PHP version first shipped it.)
- The list belongs to the current item (`in_array('gift', $order['tags'])`). There's no cross product.
- The loop runs a few times by design.

## How backslop detects it

The scanner flags a lookup inside a loop body. Loop bodies include `foreach`/`for`/`while`, `array_map`/`array_filter` callbacks, Laravel `->map/->filter/->each` callbacks, JS array callbacks and Python comprehensions. It flags these lookups:
- PHP: `in_array` / `array_search` whose haystack is a variable, a property, or an `array_keys/array_column/array_map(...)` call. Also `->contains($value)` on a collection variable.
- JS/TS: `.includes` / `.indexOf` / `.lastIndexOf`, only when the file shows the receiver is an array. That means a `T[]` / `Array<T>` type, `.push()` calls, an `= []` start, or a value built by `.map/.filter/Object.keys/Array.from/findMany`. A string receiver has the same methods, so without that evidence the line is skipped.
- Python: `x in name` / `x not in name`, only when `name` is visibly a list: a `list[...]` annotation, `.append()` calls, a list comprehension, `list(...)` or `.values_list(...)`. Names bound to `set`/`dict` are skipped. The `in` of `for x in xs` is skipped.

It skips:
- literal lists and class constants, and UPPER_CASE module constants (JS/Python)
- haystacks that depend on a loop variable, or that are reassigned inside the loop
- tests, fixtures, seeders and migrations

Severity is medium because the scanner can't see how big the haystack is.

## Sources

- php-src `ext/standard/array.c`, `_php_search_array()` (shared by `in_array` and `array_search`): https://github.com/php/php-src/blob/master/ext/standard/array.c
- php-src `Zend/zend_vm_def.h`, `ZEND_IN_ARRAY` handler; optimizer commit "Replace calls to in_array() with constant array by IN_ARRAY instruction" (2017).
- MDN, Set, "Performance": https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
- Python docs, "Time complexity of operations on built-in types": https://docs.python.org/3/builtins/time-complexity.html
- eslint-plugin-unicorn `prefer-set-has` (an array used only for `.includes()` checks).
