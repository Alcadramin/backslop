---
name: backslop-loops
description: Catches slow, over-complicated collection code agents write. Covers in_array/includes inside loops, nested-loop joins, array_merge and spread accumulators, array_values(array_filter(array_map())) chains, and array_keys/array_combine round-trips. Use when writing or reviewing loops, or when asked to optimize, simplify or fix slow code, timeouts or O(n²) behaviour.
---

# backslop-loops: one clear pass, no quadratic surprises

Agents write O(n²) loops, and they stack `array_values`, `array_keys`, `array_combine` and `array_filter` calls that a simple `foreach` would do in one pass. The code is complex for no reason. It passes every test because test data has ten rows. In production it has ten thousand. Each habit has a cause. "For each user, find their orders" turns into a nested scan. "Make it a list to be safe" turns into an `array_values` around something that's already a list. "Use the functional style" turns into four nested calls that read inside-out.

The fix is almost always shorter than the slop:

```php
// what agents write: 3 passes, 3 temporary arrays, read from the inside out
$emails = array_values(array_unique(array_filter(array_map(fn ($u) => strtolower($u['email']), $users))));
$byId   = array_combine(array_keys($rows), array_values($rows));       // that's just $rows
foreach (array_keys($prices) as $sku) { $total += $prices[$sku]; }     // keys, then index back

// what it should be
$emails = [];
foreach ($users as $u) {
    $e = strtolower($u['email']);
    if ($e !== '') $emails[$e] = true;            // dedupe by key as you go
}
$emails = array_keys($emails);
$byId = $rows;
foreach ($prices as $sku => $price) { $total += $price; }
```

## Use this when

- You write or change a `foreach`/`for`/`while`, an `array_map`/`array_filter`, a `.map/.filter/.reduce`, a Laravel collection callback or a Python comprehension.
- You're asked to **optimize**, **speed up** or fix a **slow** endpoint, a **timeout** or a job that "takes forever". Agents often swap an N+1 query for an O(n·m) in-memory join and call it fixed.
- You're asked to **simplify** or **clean up** code. That's when agents add `array_values(array_keys(...))` round-trips and pipelines nested four deep.
- You're merging, deduping, sorting or grouping data inside a loop.
- You load two result sets and match them up in code.

## Non-negotiable rules

1. Never search a list inside a loop (`in_array`, `array_search`, `.includes`, `.indexOf`, `.find`, `x in list`). Build a keyed lookup once: `array_flip` + `isset`, `Set`, `Map`, `set`, `dict`.
2. Never join two collections with a nested loop or a `filter`/`find` per item. Index one side by the join key first.
3. Never grow a collection by copying it (`$a = array_merge($a, ...)`, `[...acc, x]`, `{...acc, [k]: v}` in reduce, `xs = xs + ys`). Append in place, or merge once after the loop.
4. Never put an `array_values`/`array_keys`/`array_combine`/`array_flip` stage that undoes another one. Know what each call returns: `array_keys`, `explode` and `range` already return lists.
5. Don't nest three or more `array_*` calls. Write one `foreach` that filters, maps and dedupes as it goes.
6. Never sort, dedupe or `array_shift`/`pop(0)` the accumulator inside the loop that grows it. Do it once after the loop, or use a heap or queue.
7. Never read the same file or rebuild the same lookup inside a loop. Hoist it.
8. Never filter everything to get the first match or a yes/no. Use `array_find`/`array_any`/`foreach` + `break`, `.find`/`.some`, or `next`/`any`.
9. Never "fix" a finding by hiding it: no ignore comments, no moving the loop into a helper the scanner can't see.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-loops
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

The usual honest false positive is a loop that is small and fixed by design (three config files, five enum values). If that's the case, say why it's bounded.

## Review checklist

Ask these about each loop or collection call you wrote or changed.

**Lookups and joins**
- Is there a membership test inside this loop? Is its haystack data-sized? → [linear-lookup-in-loop](references/linear-lookup-in-loop.md)
- Does this loop search another collection for "the matching row"? Index it by key instead. → [nested-loop-join](references/nested-loop-join.md)
- Is there a query or HTTP call per iteration? → [n-plus-one-query-in-loop](../backslop-queries/references/n-plus-one-query-in-loop.md)

**Building collections**
- Does the accumulator get copied on each iteration (`array_merge`, spread, `concat`, `+`)? → [accumulate-by-copy-in-loop](references/accumulate-by-copy-in-loop.md)
- Is the accumulator sorted inside the loop? → [sort-in-loop](references/sort-in-loop.md)
- Is it deduped inside the loop? → [dedupe-in-loop](references/dedupe-in-loop.md)
- Is something taken off the front of an array in a loop (`array_shift`, `pop(0)`, `array_unshift`)? → [front-removal-in-loop](references/front-removal-in-loop.md)

**Doing it in one pass**
- Does a stage undo another, or re-implement `array_column`? → [key-value-roundtrip](references/key-value-roundtrip.md)
- Are three or more `array_*` calls nested? Would one `foreach` say it more plainly? → [multi-pass-pipeline](references/multi-pass-pipeline.md)
- Does it filter everything to read `[0]` or check "any"? → [filter-then-take-first](references/filter-then-take-first.md)
- Does it loop over keys only to index back into the same array? → [iterate-keys-then-index](references/iterate-keys-then-index.md)
- Does anything inside the loop not depend on the loop? Hoist it. → [loop-invariant-work](references/loop-invariant-work.md)

**Review-only (no scanner rule, and be honest about them)**
- Does recursion revisit the same nodes, or query per level? → [unmemoized-overlapping-recursion](references/unmemoized-overlapping-recursion.md)
- Is a try/catch used per item as an `if`, swallowing failures? → [exceptions-as-loop-control](references/exceptions-as-loop-control.md)
- `count()` in a `for` condition is fine on modern PHP. Is the condition doing real O(n) work? → [size-call-in-loop-condition](references/size-call-in-loop-condition.md)
- Python `s += ...` in a loop, or a huge payload built in memory? PHP `.=` is fine. → [string-build-in-loop](references/string-build-in-loop.md)
- Does `isset` reject keys whose value is a real `null`? Choose by meaning, not by speed folklore. → [isset-vs-array-key-exists](references/isset-vs-array-key-exists.md)

## Patterns

| Pattern | What goes wrong | Detected |
|---|---|---|
| [linear-lookup-in-loop](references/linear-lookup-in-loop.md) | `in_array`/`.includes`/`x in list` per item: O(n·m) | scanner |
| [nested-loop-join](references/nested-loop-join.md) | two loaded result sets matched with a scan per item | scanner |
| [accumulate-by-copy-in-loop](references/accumulate-by-copy-in-loop.md) | `$a = array_merge($a, ...)`, `{...acc}` in reduce: O(n²) | scanner (high) |
| [key-value-roundtrip](references/key-value-roundtrip.md) | `array_values(array_keys())`, `array_combine(array_keys(), array_values())`, hand-rolled `array_column` | scanner |
| [multi-pass-pipeline](references/multi-pass-pipeline.md) | `array_values(array_filter(array_map(...)))`: a pass and an array per stage | scanner (PHP), review |
| [filter-then-take-first](references/filter-then-take-first.md) | `array_filter(...)[0]` (also a key bug), `.filter().length > 0` | scanner |
| [iterate-keys-then-index](references/iterate-keys-then-index.md) | `foreach (array_keys($a) as $k) { $a[$k] }` | scanner |
| [sort-in-loop](references/sort-in-loop.md) | re-sorting a growing list every iteration | scanner |
| [dedupe-in-loop](references/dedupe-in-loop.md) | `array_unique`/`new Set` over the whole accumulator per iteration | scanner |
| [front-removal-in-loop](references/front-removal-in-loop.md) | `array_shift`/`pop(0)` drain: O(n²) | scanner (PHP, Python) |
| [loop-invariant-work](references/loop-invariant-work.md) | same file read or same lookup rebuilt per iteration | scanner |
| [n-plus-one-query-in-loop](../backslop-queries/references/n-plus-one-query-in-loop.md) | a query or HTTP call per iteration | owned by backslop-queries |
| [unmemoized-overlapping-recursion](references/unmemoized-overlapping-recursion.md) | recursion that recomputes shared subtrees | review |
| [exceptions-as-loop-control](references/exceptions-as-loop-control.md) | try/catch + `continue` as a validity check | review |
| [size-call-in-loop-condition](references/size-call-in-loop-condition.md) | mostly a myth; only O(n) conditions matter | review |
| [string-build-in-loop](references/string-build-in-loop.md) | Python `+=`; PHP `.=` is fine | review |
| [isset-vs-array-key-exists](references/isset-vs-array-key-exists.md) | `isset` drops real nulls; the speed gap is folklore | review |

## Before you say done

State this in your final reply:
- For each loop you wrote over data, its complexity in plain words ("one pass over orders, plus a keyed lookup into banned users") and the largest n it will see.
- Each lookup structure you built (`array_flip`, `Set`, `Map`, `dict`) and that it's built outside the loop.
- For any in-memory join, which side you indexed and by which key.
- That you ran the diff check above, and either fixed each finding or gave the reason it's a false positive (for example, "bounded: iterates the 3 configured locales").
