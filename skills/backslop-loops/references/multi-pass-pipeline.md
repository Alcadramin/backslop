# multi-pass-pipeline

**Three or more nested `array_*` calls: one full pass and one temporary array per stage, read inside-out.**

Severity: low · Detected by: scanner (static, PHP) · review for JS/TS and Python · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$emails = array_values(array_unique(array_filter(array_map(
    fn ($u) => strtolower(trim($u['email'])),
    array_filter($users, fn ($u) => $u['active'])
))));

$tags = array_values(array_filter(array_map('trim', explode(',', $value))));

$uuids = array_values(array_map(
    fn (string $uri): string => substr($uri, 0, -4),
    array_filter($uris, fn (string $uri): bool => str_ends_with($uri, '.vcf')),
));
```

```ts
const emails = users.filter((u) => u.active).map((u) => u.email.trim().toLowerCase()).filter(Boolean).map(normalize);
```

## Why it hurts

PHP's `array_*` functions are eager. Each one walks its whole input and returns a new array, so five nested calls means five passes and five arrays where one `foreach` makes one. Often one of the stages does nothing, like an `array_values` "to be safe" on something that's already a list, or an `array_filter` that drops values the next stage would skip anyway.

The bigger cost is reading it. You read the call from the inside out, keep track of which stage keeps keys, and only then see that a plain loop would have said the same thing in five lines.

Be fair to pipelines, though. Fowler's *Replace Loop with Pipeline* recommends them for clarity, and he advises: "Focus on clarity over performance, unless you have a measured, significant performance problem." A short pipeline is fine. The rule here is one clear pass: a two-stage `array_values(array_filter(...))` is fine, but a five-deep nest with no-op stages isn't.

## Fix

One foreach that filters, transforms and dedupes as it goes:

```php
$emails = [];
foreach ($users as $u) {
    if (!$u['active']) {
        continue;
    }
    $e = strtolower(trim($u['email']));
    if ($e !== '') {
        $emails[$e] = true;     // dedupe by key: no array_unique pass
    }
}
$emails = array_keys($emails);
```

```php
$tags = [];
foreach (explode(',', $value) as $t) {
    $t = trim($t);
    if ($t !== '') {
        $tags[] = $t;
    }
}
```

In Python, use one comprehension: `[e for u in users if u.active and (e := normalize(u.email))]`.

## When it's fine

- Short pipelines (two stages) over small arrays. They read well and cost nothing you could measure.
- `array_values(array_filter(...))` when the caller needs a list, for example for a JSON array, because `array_filter` keeps keys.
- Lazy pipelines: Laravel `LazyCollection`, generators, Python `map`/`filter` iterators. These don't build a full array per stage.
- JS chains: `.filter().map()` is idiomatic. Flag a JS chain in review only when it's long, has no-op stages, or computes values it then throws away. The scanner doesn't flag JS chains.

## How backslop detects it

PHP only. The scanner measures how deeply eager `array_*` calls nest: `map`, `filter`, `values`, `keys`, `unique`, `merge`, `column`, `combine`, `flip`, `reverse`, `slice`, `fill_keys`, `diff*`, `intersect*`, `chunk`. It follows only the arguments the data flows through:
- for `array_map`, its arrays
- for `array_merge` and `array_combine`, every argument
- for the rest, the first argument

It reports the outermost call of a chain three or more deep. Callbacks don't count as stages, so an `array_keys` inside a callback is per-item work. The subtractor of `array_diff` doesn't count either. Tests are skipped.

## Sources

- Fowler, *Refactoring* 2nd ed., ch. 3 "Bad Smells in Code" (Loops); *Replace Loop with Pipeline*: https://refactoring.com/catalog/replaceLoopWithPipeline.html
- Fowler, "Refactoring with Loops and Collection Pipelines": https://martinfowler.com/articles/refactoring-pipelines.html
- Fowler, *Split Loop* (the reverse trade-off): https://refactoring.com/catalog/splitLoop.html
- Ruff `PERF401` / `PERF402` (push Python loops toward comprehensions, which are single-pass).
