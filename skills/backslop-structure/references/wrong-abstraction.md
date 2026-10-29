# wrong-abstraction

**A shared helper that grows a parameter and a branch for each new caller, until no caller uses all of it.**

Severity: medium · Detected by: review only (the first step is caught by [boolean-flag-param](boolean-flag-param.md)) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Two blocks looked alike, so they were extracted. A third case almost fit, so it got a parameter. After a few rounds:

```php
function buildReport(array $rows, string $type, bool $forAdmin = false, bool $legacy = false)
{
    if ($type === 'sales') { /* ... */ if ($forAdmin) { /* ... */ } }
    elseif ($type === 'stock') { /* ... */ if ($legacy) { /* ... */ } }
}
```

```ts
function processItem(item: Item, mode: 'import' | 'sync' | 'repair', opts: { skipValidation?: boolean; legacy?: boolean } = {}) { /* ... */ }
```

Agents do this readily: told to "reuse existing code" or "keep it DRY", they bend the nearest helper instead of writing a second one.

## Why it hurts

Each caller pays for the paths it doesn't use. To change one, you have to understand all of them and keep them all working. The parameter combinations multiply, so tests cover a few of them and the rest go untested. Metz's observation is that the sunk cost makes everyone keep adding to it.

## Fix

Metz's remedy:
1. Inline the helper back into every caller.
2. In each caller, delete the branches that caller doesn't take.
3. Re-extract only what is still truly shared, if anything.

```php
function buildSalesReport(array $rows): array { /* ... */ }
function buildStockReport(array $rows): array { /* ... */ }
// plus a small shared helper for the part that really is the same
```

When a new case almost fits an existing helper, the default is to write a second function and let the duplication stand. Merge later, when the shared part is clear.

## When it's fine

- Real strategy dispatch where the variants share most of the logic and differ in one well-named step (pass that step in, or use polymorphism).
- An enum parameter that selects data, not behaviour (`$currency`, `$locale`).

## How backslop detects it

Review only. When you add a parameter or a branch to a function that other code already calls, check:
- How many callers pass it? One means the variation belongs to that caller.
- How many paths does each caller use? If no caller uses all of them, inline and re-extract.

The scanner rule [boolean-flag-param](boolean-flag-param.md) flags the most common first step: a boolean bolted onto an existing function with a branch on it.

## Sources

- Metz, "The Wrong Abstraction" (the inline-then-re-extract remedy; "duplication is far cheaper than the wrong abstraction"): https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- Fowler, *Inline Function*: https://refactoring.com/catalog/inlineFunction.html
- Fowler, bliki "Yagni": https://martinfowler.com/bliki/Yagni.html
