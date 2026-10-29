# duplicate-helper

**A new helper that copies one that already exists, in this file, this repo or the framework.**

Severity: low · Detected by: scanner (static, same-file copies) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The agent doesn't search before writing, so the codebase gets a second `formatPrice()` next to `formatMoney()`, a third `slugify()`, or an `array_get()` in a Laravel app that has `Arr::get`.

```php
// app/Support/Money.php already has format_money(int $cents): string
function formatPrice(int $amount): string {
    return number_format($amount / 100, 2, ',', '.') . ' TL';
}
```

```ts
// src/lib/money.ts already exports formatMoney(cents)
export function formatCurrency(cents: number) { /* same thing */ }
```

```python
def for_channel(self, slug):          # same body as for_channel_and_click_and_collect() above it
    channels = Channel.objects.filter(slug=slug).values("pk")
    ...
```

## Why it hurts

Two copies of one piece of knowledge drift apart: one gets the rounding fix and the other doesn't, and the bug comes back from the copy. That is what DRY is about: duplicated knowledge, not lines that happen to look alike. GitClear's analysis of 211 million changed lines found that blocks of five or more duplicated lines rose eightfold during 2024 while moved (refactored) lines fell 39.9%. That is a correlation across the industry, not a per-line measurement of AI code. In a study of rejected agent pull requests, 23% of the 600 annotated rejections were duplicate PRs.

## Fix

Search first: the repo (`grep -rn "function format\|def format\|export function format"`), the framework helpers, and the installed packages. Then call the existing one, or extend it if it is missing one case.

```php
$label = format_money($order->total_cents);
```

## When duplication is the right call

Duplication is cheaper than the wrong abstraction (Sandi Metz). Keep two copies when:
- The two pieces look the same today but serve different intents and will change for different reasons. Two policy abilities (`update`, `destroy`) with the same rule today, or two GraphQL resolvers the framework dispatches by name. If you want one place, make one call the other. Don't build a parameterised helper.
- Merging them would need a flag or a type switch to tell the callers apart. That is [wrong-abstraction](wrong-abstraction.md) in the making.
- The code is a test, a fixture or generated.

## How backslop detects it

The scanner compares the bodies of named functions within one file. It reports a function whose body matches an earlier one after:
- comments and whitespace are dropped,
- the function's own parameter names are normalised.

It does not report:
- bodies shorter than 3 lines or 80 characters,
- functions whose parameter types differ (`Contact $c` vs `Group $g`),
- functions whose string literals differ,
- test functions and test files.

In diff mode the finding lands only when the later copy is on an added line. Copies across files are review-only: search the repo for the function's name tokens (`format` + `money|price|currency`) and for its key calls.

## Sources

- Hunt & Thomas, *The Pragmatic Programmer* 20th anniv. ed., Topic 9 "DRY—The Evils of Duplication".
- Fowler, *Refactoring* 2nd ed., ch. 3 (Duplicated Code).
- Metz, "The Wrong Abstraction" ("duplication is far cheaper than the wrong abstraction"): https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- GitClear 2025 data via DevClass: https://www.devclass.com/ai-ml/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/1626250
- Chatterjee et al., failed agentic PRs (600 annotated rejections, 23% duplicates): https://arxiv.org/html/2601.15195v1
