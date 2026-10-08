# finally-overrides-exception

**A `return`, `throw`, `break` or `continue` inside `finally` replaces the exception in flight, which then vanishes.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
try {
    return $this->import($file);
} finally {
    fclose($h);
    return true;          // import exceptions are swallowed; the caller sees success
}
```

```ts
try { await save(); } finally { return { ok: true }; }
```

```python
for item in items:
    try:
        handle(item)
    finally:
        break             # any exception from handle() is dropped
```

## Why it hurts

It reads like cleanup but changes control flow. A jump out of `finally` discards whatever was in flight: the exception, or the try block's return value. The caller gets `true` or `{ ok: true }` for an operation that failed, with no trace. Python 3.14 now emits a `SyntaxWarning` for return/break/continue in `finally` (PEP 765). The PEP's survey of real code found most such uses were wrong and swallowed exceptions by accident.

## Fix

Keep `finally` for cleanup only. Put the jump after the try statement:

```php
try {
    $result = $this->import($file);
} finally {
    fclose($h);
}
return $result;
```

## When it's fine

- `break`/`continue` of a loop that sits entirely inside the finally block.
- `return` inside a function or closure defined inside the finally block.

## How backslop detects it

Inside a `finally` block: `return`, `throw`, `break` or `continue` in PHP and JS/TS, and `return`, `break` or `continue` in Python. Skipped: jumps inside a nested function, closure or callback, `break`/`continue` of a loop or `switch` that is inside the finally block, and property names such as `iterator.return()`.

## Sources

- PEP 765, "Disallow return/break/continue that exit a finally block": https://peps.python.org/pep-0765/
- ESLint `no-unsafe-finally`; Ruff `B012` (jump-statement-in-finally).
- PHPStan `ReturnInFinallyRule` and `OverwrittenExitPointByFinallyRule`: https://github.com/phpstan/phpstan-src/tree/2.1.x/src/Rules/Exceptions
