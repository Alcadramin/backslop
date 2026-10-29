# reimplemented-stdlib

**Hand-writing what the language or framework already provides.**

Severity: medium · Detected by: review only (use Rector, Ruff, eslint-plugin-unicorn for the mechanical cases) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$found = false;
foreach ($roles as $r) {
    if ($r === 'admin') { $found = true; break; }
}
if (strpos($path, '/api/') !== false) { /* ... */ }      // PHP 8 has str_contains
```

```ts
let hasOverdue = false;
for (const inv of invoices) { if (inv.overdue) { hasOverdue = true; break; } }
```

```python
def has_overdue(invoices):
    for inv in invoices:
        if inv.overdue:
            return True
    return False
```

## Why it hurts

The hand-written version is more code to read, and it gets edge cases wrong that the built-in already handles: strict vs loose comparison, empty input, key preservation, Unicode. Each copy is another place a bug can hide. Bloch's advice, "know and use the libraries", applies to every language.

## Fix

```php
$found = in_array('admin', $roles, true);
if (str_contains($path, '/api/')) { /* ... */ }
```

```ts
const hasOverdue = invoices.some((inv) => inv.overdue);
```

```python
has_overdue = any(inv.overdue for inv in invoices)
```

Other common ones: PHP `array_sum`, `max`, `array_column`, `str_starts_with` (8.0), `array_key_first`/`array_key_last` (7.3), `array_is_list` (8.1), `array_find`/`array_any` (8.4); Laravel `Arr::get`, `data_get`, `Str::slug`; JS `every`, `includes`, `flat`, `Object.groupBy`, `structuredClone`, `crypto.randomUUID`; Python `sum`, `all`, `collections.Counter`, `defaultdict`, `itertools`.

## When it's fine

- The built-in has different semantics the code needs (loose comparison, preserved keys, a stable order).
- The project's runtime is older than the function. Check `composer.json` `require.php`, `package.json` `engines` or `pyproject.toml` `requires-python` before suggesting a newer one.
- The loop does more than one thing per item and a built-in would need several passes.

## How backslop detects it

Review only. Before writing a helper or a loop with a flag variable, check whether the language, the framework or an installed package already has it. Rector (`ForeachToInArrayRector`, `StrContainsRector`, `StrStartsWithRector`), Ruff `SIM110` and unicorn (`prefer-includes`, `prefer-array-some`, `prefer-structured-clone`) catch the mechanical shapes with a real parser.

## Sources

- Bloch, *Effective Java* 3rd ed., Item 59 "Know and use the libraries".
- Fowler, *Replace Inline Code with Function Call*: https://refactoring.com/catalog/replaceInlineCodeWithFunctionCall.html; *Substitute Algorithm*: https://refactoring.com/catalog/substituteAlgorithm.html
