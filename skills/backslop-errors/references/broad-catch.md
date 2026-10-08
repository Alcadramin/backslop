# broad-catch

**Catching everything (`\Throwable`, `Exception`, bare `except:`) around code that can fail in one known way.**

Severity: low · Detected by: scanner (Python bare `except:` only) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
try { $user = $api->user($id); } catch (\Throwable $e) { return null; }
```

```python
try:
    qty = int(form["qty"])
except:                     # also catches KeyboardInterrupt, SystemExit, and the KeyError from a typo
    qty = 1
```

## Why it hurts

A catch-all also catches the bugs. In PHP, `\Throwable` includes `Error`: `TypeError`, calls to undefined methods, `DivisionByZeroError`. In Python, `except Exception` catches the `KeyError` or `AttributeError` from a typo. These then take the "expected failure" path ([fallback-that-lies](fallback-that-lies.md), [catch-log-continue](catch-log-continue.md)) instead of crashing in tests where someone would see them.

A bare `except:` is worse. PEP 8: it "will catch SystemExit and KeyboardInterrupt exceptions, making it harder to interrupt a program with Control-C, and can disguise other problems."

## Fix

Catch the type you can handle and let the rest reach the top-level handler:

```php
try { $user = $api->user($id); } catch (NotFoundHttpException $e) { return null; }
```

```python
try:
    qty = int(form["qty"])
except ValueError:
    qty = 1
```

JS can't catch by type, so check inside the catch and rethrow the rest:

```ts
catch (err) {
  if (err instanceof NotFoundError) return null;
  throw err;
}
```

## When it's fine

- Top-level boundaries: the global exception handler, HTTP middleware, a queue worker loop, a CLI `main`. They should catch everything, report it and translate it.
- Catch-all for cleanup that then rethrows.

## How backslop detects it

Only Python's bare `except:` and `except BaseException` are flagged, and only when the block doesn't re-raise or exit (`raise`, `sys.exit`). A PHP `catch (\Throwable $e)` or Python `except Exception` is too common at legitimate boundaries to flag alone. backslop flags those only when the body also swallows the error: [empty-catch](empty-catch.md), [fallback-that-lies](fallback-that-lies.md), [catch-log-continue](catch-log-continue.md). Review the rest by hand.

## Sources

- PEP 8, Programming Recommendations (bare `except:`): https://peps.python.org/pep-0008/
- Joshua Bloch, *Effective Java* (3rd ed.), Item 77 "Don't ignore exceptions" and Item 73 "Throw exceptions appropriate to the abstraction".
- PHP manual, class `Error`: https://www.php.net/manual/en/class.error.php
- pylint `broad-exception-caught` (W0718), `bare-except` (W0702): https://pylint.readthedocs.io/en/stable/user_guide/messages/warning/broad-exception-caught.html ; Ruff `BLE001`, `E722`.
