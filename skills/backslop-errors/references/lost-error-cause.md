# lost-error-cause

**A new error thrown inside a catch without the original, so the real cause is gone.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript

## What it looks like

```php
try {
    $this->db->insert('orders', $order->toArray());
} catch (PDOException $e) {
    throw new RepositoryException('Save failed');
}
```

```ts
try { await crm.push(id); }
catch (err) { throw new Error('sync failed'); }
```

## Why it hurts

The log now says "Save failed", with a stack trace that points at the catch block. Whether it was a deadlock, a constraint violation or a dropped connection is gone. Somebody has to reproduce the failure to learn what the original error already said.

Wrapping a low-level error in a domain error is good (Bloch, Item 73). Just keep the cause attached, and put the failing values in the message (Item 75).

## Fix

```php
catch (PDOException $e) {
    throw new RepositoryException("Saving order {$order->id} failed", 0, $e);   // 3rd arg: $previous
}
```

```ts
catch (err) {
  throw new Error(`sync ${id} failed`, { cause: err });
}
```

If the error must not reach an API client (don't leak database errors), log the cause on the server first, then throw the clean error.

## When it's fine

- Translating "not found" into an HTTP 404 or a validation error. The cause is already known. backslop skips thrown classes named like `NotFoundHttpException`, `ValidationException`, `Unauthorized`, `Forbidden` or `BadRequest`.
- The try body only parses input (`JSON.parse`, `json_decode`, `BigInt`, `new URL`). A parse failure means bad input, and the new message says so.

Python isn't checked. Raising inside `except` chains automatically: the new exception's `__context__` is set to the one being handled, and the default traceback shows both. `raise X(...) from e` is still clearer (Ruff `B904`), but nothing is lost without it.

## How backslop detects it

Inside a PHP or JS/TS catch, a `throw new X(...)` at the catch's own level when:
- the caught variable is not mentioned anywhere in the catch (not passed, not logged, not interpolated), or
- the catch binds no variable at all (PHP 8 `catch (X)`, JS `catch {}`).

The parse-only and HTTP/validation cases above are skipped. So are test files.

## Sources

- PHP manual, `Exception::__construct` (`$previous` parameter): https://www.php.net/manual/en/exception.construct.php
- MDN, `Error: cause`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
- ESLint `preserve-caught-error`: https://eslint.org/docs/latest/rules/preserve-caught-error
- Rector `ThrowWithPreviousExceptionRector`: https://getrector.com/rule-detail/throw-with-previous-exception-rector
- Joshua Bloch, *Effective Java* (3rd ed.), Item 73 "Throw exceptions appropriate to the abstraction" and Item 75 "Include failure-capture information in detail messages".
- Python docs, Built-in Exceptions, "Exception context": https://docs.python.org/3/library/exceptions.html
