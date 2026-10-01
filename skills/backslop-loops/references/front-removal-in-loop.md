# front-removal-in-loop

**`array_shift` / `array_unshift` / `list.pop(0)` / `list.insert(0, x)` in a loop. Each call moves every remaining element.**

Severity: medium · Detected by: scanner (static, PHP and Python) · review for JS/TS · Languages: PHP, Python, TypeScript/JavaScript

## What it looks like

```php
while ($job = array_shift($queue)) {
    $this->handle($job);
}

while (!empty($queue)) {             // breadth-first walk
    $node = array_shift($queue);
    foreach ($node->children as $c) { $queue[] = $c; }
}

foreach ($rows as $r) {
    array_unshift($out, $r);         // building a reversed list from the front
}
```

```python
while queue:
    node = queue.pop(0)
    queue.extend(node.children)
```

## Why it hurts

PHP's manual says that with `array_shift`, "All numerical array keys will be modified to start counting from zero". Every call rebuilds the indexes of everything left. Python's `list.pop(0)` and `insert(0, x)` are O(n) for the same reason: every other element moves one slot. Draining a queue of n items this way is O(n²). With 50,000 jobs or nodes, that's over a billion element moves.

## Fix

```php
foreach ($queue as $job) { $this->handle($job); }     // you just need to iterate

$q = new SplQueue();                                  // a real FIFO
$q->enqueue($root);
while (!$q->isEmpty()) {
    $node = $q->dequeue();
    foreach ($node->children as $c) { $q->enqueue($c); }
}

$out = array_reverse($rows);                          // instead of unshifting one by one
```

```python
from collections import deque
queue = deque([root])
while queue:
    node = queue.popleft()
    queue.extend(node.children)
```

If order doesn't matter, popping from the end (`array_pop`, `list.pop()`) is O(1).

## When it's fine

- Small queues by design, such as a few path segments. The scanner skips lists rebuilt in each iteration, like `$parts = explode(' ', $line); array_shift($parts);`.
- String-keyed PHP arrays: `array_shift` doesn't renumber string keys, but it still rebuilds the hash.
- JavaScript: engines have fast paths for `Array#shift` on some arrays. We found no primary source we'd cite for its cost, so `.shift()` in a loop is review-only. Measure if it matters.

## How backslop detects it

The scanner flags:
- PHP: `array_shift` in a `while (...)` condition, and `array_shift` / `array_unshift` inside a loop body
- Python: `.pop(0)` and `.insert(0, ...)` inside a loop body

It skips:
- lists that are loop variables
- lists that are reassigned inside the loop, since those are per-iteration
- tests, fixtures, seeders and migrations

## Sources

- PHP manual, `array_shift`: https://www.php.net/manual/en/function.array-shift.php
- Python docs, "Time complexity of operations on built-in types" (`pop(k)` / `insert(k, x)` are O(n−k); use `collections.deque` for both ends): https://docs.python.org/3/builtins/time-complexity.html
