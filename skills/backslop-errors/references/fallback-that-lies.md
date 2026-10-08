# fallback-that-lies

**A catch that returns `[]`, `0`, `''` or `true`, so a failure looks like a normal result.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The agent's version of "make the demo never fail": wrap the I/O, return something empty.

```php
public function permissions(User $user): array
{
    try {
        return $this->http->get("/users/{$user->id}/permissions")->json();
    } catch (\Throwable $e) {
        return [];                 // an outage now means "this user has no permissions"
    }
}

public function balance(int $userId): int
{
    try { return $this->ledger->balance($userId); } catch (\Throwable $e) { return 0; }
}
```

```ts
const rates = await fetchRates().catch(() => ({}));
try { await mailer.send(mail); return true; } catch { return true; }
```

```python
try:
    return list(Order.objects.filter(user=user))
except Exception:
    return []
```

## Why it hurts

The caller can't tell "failed" from "there is nothing". So it doesn't handle the failure. It shows a customer a zero balance, treats an outage as "no permissions", skips a sync because the list was empty, or reports an email as sent. Nothing is logged, so nobody notices until the data is wrong.

Ousterhout's "define errors out of existence" doesn't apply here. That idea means changing what an operation means so the case is no longer an error (deleting a key that isn't there is a no-op). Returning `[]` when the database is down doesn't change what the operation means. It hides the failure. His own book warns against taking the idea too far.

Tests don't see it: test databases and mocked HTTP clients don't fail.

## Fix

Let the error propagate. Or return a failure the caller has to deal with:

```php
public function balance(int $userId): int
{
    return $this->ledger->balance($userId);          // errors reach the handler
}
```

```ts
type RatesResult = { ok: true; rates: Rates } | { ok: false; error: unknown };
export async function loadRates(): Promise<RatesResult> {
  try { return { ok: true, rates: await fetchRates() }; }
  catch (error) { return { ok: false, error }; }
}
```

If a fallback really is right (a display-only widget), record the failure before returning it:

```python
except RatesUnavailable:
    logger.warning("rates unavailable, showing cached", exc_info=True)
    return cached_rates()
```

## When it's fine

- A narrow "not found" exception mapped to `null`: `catch (ModelNotFoundException) { return null; }` in `findOrNull()`.
- Parsing input: `tryParse`, `isValidUrl`, `JSON.parse` of untrusted text. Bad input is a normal answer there.
- `null`, `false` or `undefined` from a function whose type says "maybe". A typed caller has to handle them (`?User`, `| null`). backslop's static check doesn't flag these, but a diff that swaps a `throw` for `return null` is still flagged.
- A documented fallback that also logs or counts the failure.

## How backslop detects it

Static: a broad catch (`\Throwable`/`\Exception`, `except Exception`, any JS catch) whose whole body is `return` of `[]`, `{}`, `''`, `0`, `true`, `collect()` or an empty collection, when the try body does I/O (an `await`, an HTTP/DB/cache/file call, `Model::query`, `.objects`, `open(`). Also `promise.catch(() => [])` and `.catch(() => ({}))`. Skipped: a comment in the catch, a logged fallback, `null`/`false`/`undefined`, test files and UI code.

Diff (any catch type, any value including `null`):
- a removed `throw`/`raise` in a catch that now only returns, or
- a new try/catch that returns a value, wrapped around lines that already existed.

## Sources

- Hunt & Thomas, *The Pragmatic Programmer* (20th anniversary ed.), Topic 24 "Dead Programs Tell No Lies".
- Steve McConnell, *Code Complete* (2nd ed.), ch. 8 "Defensive Programming", §8.3 "Error-Handling Techniques" (robustness vs. correctness).
- John Ousterhout, *A Philosophy of Software Design*, ch. 10 "Define Errors Out of Existence" (and the section "Taking it too far").
- The same pattern inside a transaction commits partial data: see [swallowed-exception-in-transaction](../../backslop-connections/references/swallowed-exception-in-transaction.md).
