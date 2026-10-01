# exceptions-as-loop-control

**A try/catch around every iteration used as a type or validity check, usually with `continue` and nothing recorded.**

Severity: medium (low in Python) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
foreach ($rows as $r) {
    try {
        $d = new DateTimeImmutable($r['date']);
    } catch (\Exception $e) {
        continue;                 // bad rows vanish, and so would any other error
    }
    $out[] = $d;
}
```

```ts
for (const s of inputs) {
  try { out.push(JSON.parse(s)); } catch {}
}
```

## Why it hurts

- **It costs more than a check.** Creating an exception captures a stack trace, which is much more expensive than an `if`. When invalid input is common, you pay that cost often.
- **It hides real bugs.** The broad catch with `continue` swallows every other error in the block too, such as a typo, a null or a timezone misconfiguration. The rows disappear, and the result looks complete.

Bloch's *Effective Java* (Item 69) makes the same point: exceptions are for exceptional conditions, not ordinary control flow.

## Fix

Use a check that returns a value, and record the failures:

```php
foreach ($rows as $r) {
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $r['date']);
    if ($d === false) {
        $invalid[] = $r;          // explicit and counted
        continue;
    }
    $out[] = $d;
}
```

Other checks that return a value: `filter_var`, `ctype_digit`, `is_numeric`. If one failure should stop the whole batch, move the `try` outside the loop.

## When it's fine

- Python EAFP (`try: int(x) except ValueError:`) is idiomatic. Since Python 3.11 the no-exception path is "zero-cost", so Ruff only enforces `PERF203` on older versions. Flag Python only when exceptions are the common path.
- Per-item I/O where the exception is the only failure signal the library gives (HTTP clients, `json_decode` with `JSON_THROW_ON_ERROR`), as long as the failure is recorded, not dropped.

## How backslop detects it

Review only. In review, look for a `try` inside a loop whose catch only does `continue`, does nothing, or sets a default. The silent-swallow part overlaps with the error-handling skill's empty-catch checks, so this skill doesn't add a second rule for it.

## Sources

- Bloch, *Effective Java* 3rd ed., Item 69 "Use exceptions only for exceptional conditions".
- Fowler, *Replace Exception with Precheck*: https://refactoring.com/catalog/replaceExceptionWithPrecheck.html
- Ruff `PERF203` try-except-in-loop (enforced only before Python 3.11): https://docs.astral.sh/ruff/rules/try-except-in-loop/
- Ruff `S112` try-except-continue; ESLint `no-empty`.
