# catch-rethrow-same

**A catch that only rethrows the error it caught. The try/catch does nothing.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The agent wraps code in try/catch "for safety", then has nothing to do in the catch.

```php
try { return $repo->save($u); } catch (\Exception $e) { throw $e; }
```

```ts
try { return await db.save(u); } catch (err) { throw err; }
```

```python
try:
    save(u)
except Exception as e:
    raise e
```

## Why it hurts

It adds nesting and suggests error handling exists when it doesn't. Readers look for a reason that isn't there. In Python, `raise e` also adds the re-raise line to the traceback, while a bare `raise` re-raises the exception exactly as it was.

## Fix

Delete it:

```php
return $repo->save($u);
```

## When it's fine

- It's the first of several catch clauses, rethrowing one type so a broader handler below doesn't catch it.
- There is a `finally` that needs the try.

## How backslop detects it

A catch whose whole body is `throw <caught variable>` (PHP/JS) or `raise` / `raise <caught variable>` (Python), when the try has no other catch/except clause and no `finally`, and the catch has no comment.

## Sources

- Rector `RemoveDeadTryCatchRector`: https://getrector.com/rule-detail/remove-dead-try-catch-rector
- ESLint `no-useless-catch`; Ruff `TRY203` (useless-try-except) and `TRY201` (verbose raise).
