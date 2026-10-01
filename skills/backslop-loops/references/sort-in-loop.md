# sort-in-loop

**Re-sorting a collection inside the loop that grows it: O(n² log n) where one sort after the loop is O(n log n).**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$list = [];
foreach ($events as $e) {
    $list[] = $e;
    usort($list, fn ($a, $b) => strtotime($a['at']) <=> strtotime($b['at']));
}
```

```ts
for (const p of posts) {
  out.push(p);
  out.sort((a, b) => b.createdAt - a.createdAt);
}
```

```python
top = []
for x in xs:
    top.append(x)
    top.sort()
    top = top[-10:]
```

## Why it hurts

Each sort costs O(k log k) for the k items collected so far. Doing it on every iteration adds up to O(n² log n). For 10,000 events that's roughly 10,000 sorts instead of one. The PHP example has a second problem: the comparator parses two dates on every comparison. That's O(n log n) `strtotime` calls per sort, where precomputing the timestamp once per item would do n of them.

## Fix

Collect, then sort once. Precompute expensive sort keys.

```php
foreach ($events as $e) {
    $e['ts'] = strtotime($e['at']);
    $list[] = $e;
}
usort($list, fn ($a, $b) => $a['ts'] <=> $b['ts']);
```

For "keep the top k", use a heap instead of re-sorting. In PHP that's `SplMinHeap`. In Python it's `heapq.nlargest(10, xs)`.

## When it's fine

- Sorting a different, independent list per iteration, like each group's own items. Those are separate sorts, not one growing list.
- Python's `key=` already computes each key once per item, so the comparator problem only applies to `cmp`-style comparators (`functools.cmp_to_key`).

## How backslop detects it

Inside a loop body, the scanner flags a sort call on a variable when the same loop also appends to it:
- the sort: `sort/rsort/usort/uasort/uksort/asort/arsort/ksort/krsort/natsort`, `.sort()`/`.toSorted()`, `list.sort()`, `x = sorted(x)`
- the append: `$x[] =`, `array_push`, `.push`, `.append`, `.extend`, `.insert`, `+=`

It skips:
- lists that are reset inside the loop, because those are per-iteration
- loop variables, such as each group's items
- tests, fixtures, seeders and migrations

Expensive comparators (`strtotime`, `new DateTime`, `new Date` inside a comparator) are review-only.

## Sources

- Python docs, "Time complexity of operations on built-in types" (sort is O(n log n)): https://docs.python.org/3/builtins/time-complexity.html
- PHP manual, `SplMinHeap`: https://www.php.net/manual/en/class.splminheap.php
- Python docs, `heapq`: https://docs.python.org/3/library/heapq.html
