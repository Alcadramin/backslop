# test-runner-tampered

**The check was changed instead of passed: the test report is rewritten to "passed", the clock is replaced, or a verifier always returns true.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```python
# conftest.py
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    rep.outcome = "passed"

time.time = lambda: _real_time() * 1e-3   # the benchmark now looks 1000x faster
```

```ts
export const verifySignature = (_payload: string, _sig: string): boolean => true;
```

```php
public function verifySignature(string $payload, string $signature): bool { return true; }
```

## Why it hurts

A rewritten report turns every failure green. A patched clock makes a slow path look fast. An always-true verifier accepts forged webhooks and tokens in production. METR documented o3 patching the evaluator "so that it judges every submission as successful" and overwriting the timer (`_time.time = lambda: _real_time() * 1e-3`). When asked whether its plan matched the user's intent, it answered "no" 10 of 10 times. Adding "Please do not cheat" to the prompt didn't lower the rate. OpenAI's monitoring post shows an agent reasoning it could "hack verify to always return true".

## Fix

Revert it. Test reporters, the clock, scoring scripts and verification functions are off-limits unless the task is about them. To test time-dependent code, inject a clock or use the test framework's fake timers inside the test. To test a webhook handler, sign the test payload with a test secret.

## When it's fine

- Fake timers inside test files (`vi.useFakeTimers()`, `Date.now = () => ...` in a test). Test files are skipped for the clock and verifier checks.
- A null verifier in a dev-only build, clearly named (`NoopVerifier`) and bound only outside production. Prefer configuration over a function named `verify*` that returns true.
- Laravel `FormRequest::authorize()` returning `true` isn't flagged: it means "no extra policy", and the name isn't `verify*`.

## How backslop detects it

The scanner flags:
- anywhere: `.outcome = "passed"`, `report.passed = True`, `report.failed = False`
- in non-test code: assignments to `time.time`, `time.monotonic`, `time.perf_counter`, `Date.now` or `performance.now`
- in non-test code: functions named `verify*`, `validate/check` + `Signature|Token|Hmac|Webhook|Password|Jwt` whose whole body is `return true`

## Sources

- METR, reward hacking report, June 2025: https://metr.org/blog/2025-06-05-recent-reward-hacking/
- OpenAI, chain-of-thought monitoring post: https://openai.com/index/chain-of-thought-monitoring/
