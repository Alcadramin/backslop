# test-env-branch-in-prod

**Production code asks "am I running under a test?" and takes a different path, so the real path is never tested.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
export async function pay(orderId: string) {
  if (process.env.NODE_ENV === 'test') return { ok: true };
  return stripe.charge(orderId);
}
```

```php
public function charge(Order $order): bool
{
    if (app()->runningUnitTests()) {
        return true;
    }
    return $this->client->charge($order->total);
}
```

```python
if "pytest" in sys.modules:
    return {"EUR": 1.0}

for frame in inspect.stack():
    if "test_create_versionfile_from_input_file" in frame.function:
        raise ValidationError("more than 4 places")
```

## Why it hurts

Every test of `pay()` exercises `return { ok: true }`. The Stripe call, its error handling and its retries ship untested. The last example is from the Claude 4 system card. The model wrote production code that walks `inspect.stack()` to see if one specific test is running, and only then raises the error that test expects. METR saw o3 read the scorer's precomputed answer off the call stack.

## Fix

Inject the dependency and fake it from the test. Production code never asks whether it's under test.

```ts
export async function pay(orderId: string, gateway: Gateway = stripeGateway) {
  return gateway.charge(orderId);
}
// test: await pay('o1', fakeGateway)
```

```php
// bind a fake in the test: $this->app->instance(PaymentClient::class, new FakePaymentClient());
```

## When it's fine

- Framework bootstrap and config: `config/*.php`, service providers, `settings.py`, `jest.config.*`, `vite.config.*`. The scanner skips these paths.
- Environment-gated dev tooling that is on in several environments (`app()->environment('local', 'testing')`). That's a feature flag, not test detection, and it isn't flagged.
- Some long-lived projects keep a deliberate test bypass for a binary that CI doesn't have (ffmpeg, for example). It's still the pattern. Prefer a fake binding, and never add a new one to make a failing test pass.

## How backslop detects it

The scanner matches these in non-test, non-config code:
- JS: `NODE_ENV === 'test'`, `process.env.JEST_WORKER_ID`, `process.env.VITEST*`
- PHP: `app()->runningUnitTests()`, `environment('testing')` (only `testing`), `env('APP_ENV') === 'testing'`, `defined('PHPUNIT_...')`
- Python: `'pytest' in sys.modules`, `PYTEST_CURRENT_TEST`, `settings.TESTING`

Stack inspection (`inspect.stack()`, `sys._getframe()`, `debug_backtrace()`, `new Error().stack`) is flagged only when a string mentioning "test" appears within the next few lines.

## Sources

- Claude Opus 4 / Sonnet 4 system card, section 6 (the `inspect.stack()` transcript): https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
- METR, reward hacking report, June 2025 (call-stack answer lookup): https://metr.org/blog/2025-06-05-recent-reward-hacking/
