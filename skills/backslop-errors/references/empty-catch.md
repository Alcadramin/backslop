# empty-catch

**A catch block that does nothing, so the error disappears and the code carries on.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

An agent hits an error it can't fix, wraps the call in try/catch, and the run goes green.

```php
try { $this->gateway->charge($order); } catch (\Throwable $e) {}
$order->markPaid();                       // marked paid whether or not the charge worked
```

```ts
try { await chargeCard(order); } catch {}
audit.record(order).catch(() => {});
```

```python
try:
    db.session.commit()
except Exception:
    pass
```

## Why it hurts

The failure is gone at the one place where it was known. The program keeps running in a state nobody planned for: an order marked paid without a charge, a row that was never written. The bug then shows up far away, with no log line and no stack trace. *The Pragmatic Programmer* calls this out in "Dead Programs Tell No Lies": a program that crashes early does far less damage than one that carries on with bad data.

Tests rarely catch it. The happy path never enters the catch, and the failing path now "passes" because nothing throws. That is why the agent reports the work as done.

## Fix

Let it propagate. If one failure is expected, catch that type and handle it on purpose:

```php
try {
    $this->gateway->charge($order);
} catch (CardDeclined $e) {
    $order->markDeclined($e->reason());
    return;
}
$order->markPaid();                       // anything else still propagates
```

```python
import contextlib
with contextlib.suppress(FileNotFoundError):  # narrow, and says what is ignored
    os.remove(tmp)
```

## When it's fine

- The caught type is narrow and ignoring it is the correct outcome (`FileNotFoundException` when deleting). Bloch's rule: if you ignore an exception, write a comment explaining why.
- Best-effort cleanup inside an error path, such as deleting a temp file before rethrowing the original error.
- A deliberate choice that is documented in the block. Ousterhout ("Define Errors Out of Existence", masking exceptions) argues for handling some errors at a low level so callers never see them. That is a design decision with a written reason, not a silent catch.

## How backslop detects it

Static:
- PHP and Python: an empty catch for a broad type (`\Throwable`, `\Exception`, bare `except:`, `except Exception`), or one whose body is only `pass` or `...`.
- JS/TS: any empty `catch {}`, because JS catches are untyped. Also `.catch(() => {})` and `.catch(noop)`.
- Skipped: a body with any comment, catches inside another catch or finally (cleanup), try bodies that only clean up (`unlink`, `close`, `delete`, `removeItem`), test files, and UI code (`.tsx`, `.vue`, `components/`, `resources/js/`).

Diff (any catch type, because the change itself is the evidence):
- a `throw` or `raise` was removed from a catch that is now empty, or
- a new try/catch with an empty or comment-only catch was wrapped around lines that already existed.

## Sources

- Hunt & Thomas, *The Pragmatic Programmer* (20th anniversary ed.), Topic 24 "Dead Programs Tell No Lies".
- Joshua Bloch, *Effective Java* (3rd ed.), Item 77 "Don't ignore exceptions".
- John Ousterhout, *A Philosophy of Software Design*, ch. 10 "Define Errors Out of Existence" (section "Mask exceptions").
- ESLint `no-empty`; Ruff `S110` (try-except-pass) and `SIM105` (use `contextlib.suppress`).
- Agent context: no study has measured how often agents swallow errors. It is the same "make the check pass" move documented for test edits and special-casing (Claude 3.7 Sonnet system card §6; ImpossibleBench, https://arxiv.org/abs/2510.20270). The Claude Code docs: "Claude stops when the work looks done." https://code.claude.com/docs/en/best-practices
