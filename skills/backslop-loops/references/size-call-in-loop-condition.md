# size-call-in-loop-condition

**`count()` / `strlen()` / `.length` in a loop condition. This one is mostly a myth on modern PHP and JS. It's only a real problem when the condition does O(n) work.**

Severity: low · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The folklore version, which is fine:

```php
for ($i = 0; $i < count($rows); $i++) { /* ... */ }
```

The version that's actually a problem:

```php
for ($i = 0; $i < count(array_filter($rows)); $i++) { /* filters every row, every iteration */ }
for ($i = 0; $i < count($repo->findAll()); $i++) { /* a query per iteration */ }
```

```ts
for (let i = 0; i < items.filter((x) => x.active).length; i++) { /* ... */ }
```

```python
while i < len(list(gen())):   # rebuilds the list every check
    ...
```

## Why it (usually doesn't) hurt

Old advice says `count($a)` in a `for` condition recounts the array on every iteration. In current PHP it doesn't. An array stores its element count, and `count` and `strlen` compile to dedicated VM opcodes (`ZEND_COUNT`, `ZEND_STRLEN` in php-src's `Zend/zend_vm_def.h`). Reading the count is constant time. JS `.length` is a property read. Some linters still flag the plain form (PHP_CodeSniffer `Squiz.PHP.DisallowSizeFunctionsInLoops`, and PHP Inspections EA calls it a performance issue on big arrays), but for modern PHP that claim is overstated.

The real problem is a condition that does O(n) work or I/O: filtering, querying, materialising a generator, `iterator_count()`. That runs on every iteration, so the loop becomes O(n²) or makes n queries.

## Fix

Hoist the expensive part. Prefer `foreach` when you don't need the index.

```php
$active = array_filter($rows);
$n = count($active);
for ($i = 0; $i < $n; $i++) { /* ... */ }

foreach ($rows as $row) { /* nicer still */ }
```

## When it's fine

- `count($array)`, `strlen($string)`, `.length` and `len(list)` on plain variables. These are constant time. Don't report them as a performance bug.

## How backslop detects it

Review only. It's not a scanner rule, because the harmless form is far more common than the harmful one, and a rule that fires on `count($rows)` would cost the tool its credibility. In review, look at the loop condition. It should not call a function that filters, maps, queries or builds a list.

## Sources

- php-src `Zend/zend_vm_def.h` (`ZEND_COUNT`, `ZEND_STRLEN` handlers): https://github.com/php/php-src/blob/master/Zend/zend_vm_def.h
- PHP Inspections (EA Extended), performance docs (the claim this page disagrees with for modern PHP): https://github.com/kalessil/phpinspectionsea/blob/master/docs/performance.md
- PHP_CodeSniffer `Squiz.PHP.DisallowSizeFunctionsInLoops` and `Generic.CodeAnalysis.ForLoopWithTestFunctionCall` (both fire on the harmless form too).
