# catch-log-continue

**The catch logs the error, then the code goes on as if the operation worked.**

Severity: medium · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
try {
    $gateway->charge($order);
} catch (\Throwable $e) {
    Log::error($e->getMessage());
}
$order->markPaid();                 // runs after a failed charge too
return true;
```

```ts
try { await syncAccounts(ids); } catch (e) { console.error(e); }
return res.json({ ok: true });
```

```python
try:
    broker.publish("orders", payload)
except Exception as exc:
    logger.error("publish failed: %s", exc)
order.mark_as_sent()
```

## Why it hurts

The failure turns into a log line nobody reads, and the caller is told it worked. The client gets a 200, the order is marked paid, the next step runs on a result that doesn't exist. Logging only `$e->getMessage()` also throws away the stack trace and the chain of previous exceptions. PSR-3 says an exception passed in the log context MUST go in the `'exception'` key, so log backends can keep the trace.

## Fix

Log and rethrow, or return a failure the caller checks:

```php
try {
    $gateway->charge($order);
} catch (CardDeclined $e) {
    Log::warning('card declined', ['order' => $order->id, 'exception' => $e]);
    $order->markDeclined($e->reason());
    return false;
}
$order->markPaid();                  // other errors propagate
return true;
```

```ts
try { await syncAccounts(ids); }
catch (err) {
  logger.error({ err, ids }, 'sync failed');
  return res.status(502).json({ ok: false });
}
return res.json({ ok: true });
```

In Python, use `logger.exception(...)` inside `except` to keep the traceback (Ruff `TRY400`).

## When it's fine

- Per-item handlers in a batch job or queue worker that record the item as failed and move on. The failure is counted and reported, not hidden.
- Best-effort side effects: metrics, a welcome email, cache warming, `lastUsedAt` updates.
- Fire-and-forget promises: `void job().catch((err) => logger.error(err))` is the right way to handle a floating promise.
- Top-level boundaries: the HTTP error handler, a CLI `main`, a worker loop.

## How backslop detects it

Static (deliberately narrow): a broad catch whose body only logs (`Log::`, `$this->logger->`, `report()`, `console.*`, `logger.*`, `logging.*`, `print`, Sentry), with no comment, not inside a loop or a collection callback, after which the same function reports success: `return true`, `'ok' => true`, `{ success: true }`, `->markPaid()`, `.markAsSent()` and similar.

Diff: a `throw`/`raise` removed from a catch that now only logs, or a new try/catch that only logs, wrapped around existing lines (outside loops).

Promise `.catch(log)` handlers are never flagged.

## Sources

- Hunt & Thomas, *The Pragmatic Programmer* (20th anniversary ed.), Topic 24 "Dead Programs Tell No Lies".
- Joshua Bloch, *Effective Java* (3rd ed.), Item 77 "Don't ignore exceptions".
- PSR-3 Logger Interface, §1.3 Context ("If an Exception object is passed in the context data, it MUST be in the 'exception' key."): https://www.php-fig.org/psr/psr-3/
- Ruff `TRY400` (error-instead-of-exception).
- Inside a DB transaction this also commits partial work: [swallowed-exception-in-transaction](../../backslop-connections/references/swallowed-exception-in-transaction.md).
