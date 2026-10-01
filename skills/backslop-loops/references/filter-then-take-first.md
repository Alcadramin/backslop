# filter-then-take-first

**Filtering a whole collection to read one item or answer yes/no. In PHP, `array_filter(...)[0]` is also a bug.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$admin = array_filter($users, fn ($u) => $u->isAdmin())[0] ?? null;          // bug: keys are kept
$owner = array_values(array_filter($users, fn ($u) => $u->isOwner()))[0] ?? null;
$hasBanned = count(array_filter($users, fn ($u) => $u->banned)) > 0;
```

```ts
const admin = users.filter((u) => u.isAdmin)[0];
const hasBanned = users.filter((u) => u.banned).length > 0;
```

```python
field = [c for c in configuration if c["name"] == "webhook_endpoint_id"][0]
has_banned = len([u for u in users if u.banned]) > 0
```

## Why it hurts

- **It's wasted work.** The filter checks every element and builds a new array to answer a question that could stop at the first match.
- **It's a PHP bug.** `array_filter` keeps the original keys. If the first admin is at index 3, `[0]` doesn't exist. You get an "Undefined array key" warning and `null`, even though there is a matching admin.

Tests that put the match first never see the bug.

## Fix

Use a search that stops at the first match:

```php
$admin = array_find($users, fn ($u) => $u->isAdmin());   // PHP 8.4
$hasBanned = array_any($users, fn ($u) => $u->banned);   // PHP 8.4

// before 8.4
$admin = null;
foreach ($users as $u) {
    if ($u->isAdmin()) { $admin = $u; break; }
}
```

```ts
const admin = users.find((u) => u.isAdmin);
const hasBanned = users.some((u) => u.banned);
```

```python
field = next((c for c in configuration if c["name"] == "webhook_endpoint_id"), None)
has_banned = any(u.banned for u in users)
```

## When it's fine

- You need all the matches anyway and use them later. Keep the filtered list in a variable and read `[0]` from that.
- "At least two" (`count(...) > 1`) can't stop at the first match. The scanner only flags comparisons that mean yes/no: `> 0`, `>= 1`, `== 0`, `=== 0`, `!= 0`, `< 1`.

## How backslop detects it

- PHP: `array_filter(...)[0]`, `array_values(array_filter(...))[0]`, `reset|current|array_shift(array_filter(...))`, and `count(array_filter(...))` compared with 0 or 1 as a yes/no test.
- JS/TS: `.filter(...)[0]`, `.filter(...).at(0)`, `.filter(...).shift()`, and `.filter(...).length` compared as a yes/no test.
- Python: a filtering list comprehension (with an `if`) followed by `[0]`, or `len([... if ...])` compared as a yes/no test.

Tests are skipped.

## Sources

- PHP manual, `array_find` (8.4): https://www.php.net/manual/en/function.array-find.php
- PHP manual, `array_any` (8.4): https://www.php.net/manual/en/function.array-any.php
- eslint-plugin-unicorn `prefer-array-find`, `prefer-array-some`.
- Ruff `RUF015` (`list(...)[0]` → `next(iter(...))`).
