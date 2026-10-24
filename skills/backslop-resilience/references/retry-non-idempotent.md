# retry-non-idempotent

**An automatic retry on a POST, charge or send with no idempotency key: a call that timed out but succeeded runs twice.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
Http::timeout(5)->retry(3, 300)->post('https://pay.example.com/charges', $charge);
```

```ts
await pRetry(() => fetch(`${PAY}/charges`, { method: 'POST', body }), { retries: 3 });
```

```python
Retry(total=3, backoff_factor=0.5, allowed_methods={"GET", "POST"})
```

Agents add these to make a flaky integration test pass.

## Why it hurts

A timeout doesn't mean the request failed. The server may have processed it and only the response was lost. Retrying a charge, an order creation or an email send then does it twice. AWS says APIs with side effects aren't safe to retry unless they provide idempotency, and Stripe's idempotency keys exist for exactly this: retry after a connection error without creating a second object. urllib3's `Retry` leaves POST out of its default methods; listing it in `allowed_methods` is an explicit opt-in.

A test mock fails before it does anything, so the retry looks harmless.

## Fix

Give the operation a key created once per business operation, stored with the record, and sent on every attempt. Or retry only when the connection failed before the request was sent.

```php
$key = $order->payment_idempotency_key ??= (string) Str::uuid();   // persisted before the call
Http::withHeaders(['Idempotency-Key' => $key])->timeout(5)->retry(3, 300)
    ->post('https://pay.example.com/charges', $charge);
```

```ts
const key = order.idempotencyKey;     // generated once and stored with the order
await pRetry(() => fetch(`${PAY}/charges`, {
  method: 'POST', body, headers: { 'Idempotency-Key': key }, signal: AbortSignal.timeout(5000),
}), { retries: 3 });
```

## When it's fine

- The endpoint is idempotent by design: a PUT of the whole resource, or a POST with a natural unique key the server enforces.
- The POST has no side effect (a search, a price quote, most LLM completions). The retry costs money, not correctness.
- Retries only on `ConnectionException` (Laravel `when:`), which fires before the request reaches the server. backslop skips those. A read timeout after the request was sent is still a risk.

## How backslop detects it

- PHP: a `->retry(` chained to `->post(` / `->put(` / `->patch(` in the same statement, with no `Idempotency` / request id in the function and no `ConnectionException` filter.
- Python: urllib3 `Retry(...)` with `allowed_methods` (or `method_whitelist`) containing `POST`/`PATCH`, or set to `None`/`False`.
- JS/TS: `pRetry(` / `retry(` / `asyncRetry(` whose callback does `method: 'POST'|'PATCH'` or `.post(` / `.patch(`, with no idempotency key in the function.

It reports medium, because many POST endpoints are safe to repeat. Removed `Idempotency-Key` headers are caught by [outbound-payment-no-idempotency-key](outbound-payment-no-idempotency-key.md).

## Sources

- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- AWS Builders' Library, "Making retries safe with idempotent APIs": https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- Stripe API, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Requests advanced usage (urllib3 `Retry` example with `allowed_methods`): https://requests.readthedocs.io/en/latest/user/advanced/
