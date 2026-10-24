# missing-circuit-breaker

**A hot, failure-prone dependency called on every request with no way to fail fast when it's down.**

Severity: medium (advisory) · Detected by: review only · Languages: any

## What it looks like

```ts
// every page view waits up to 3 s while the recommendations service is down
const recs = await fetch(REC_URL, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
```

```php
$recs = Http::timeout(3)->get($recsUrl)->json();   // same, on every request
```

## Why it hurts

A timeout bounds each call, but during an outage every request still waits the full timeout before it fails. At a high request rate that ties up workers and connections for the whole outage, and the failure spreads to the caller's callers (Nygard: Cascading Failures). A circuit breaker counts failures, trips open after enough of them, and then fails immediately. That frees the caller's resources and stops piling load onto a service that's trying to recover. After a cool-down it lets trial calls through (half-open) and closes again if they succeed. Fowler adds two points: log every state change, and give callers a fallback (stale data, a default, queue it for later).

## When it's overkill

Most of the time. Be honest about it:
- Low-traffic apps: a few requests a minute never exhaust anything while they wait for a timeout.
- Background jobs that already retry with backoff, or calls already behind a queue.
- Dependencies with short, good timeouts, where a slow failure is acceptable to the user.
- A breaker needs per-process or shared state and tuning. A bad threshold trips on normal noise and causes outages of its own.

Recommend one only for synchronous, user-facing calls to a dependency with a history of slow failures, at request rates where waiting on timeouts would exhaust workers. AWS notes that a local token-bucket retry budget limits retry load without a breaker; that's often enough.

## Fix (when it is warranted)

```ts
import CircuitBreaker from 'opossum';
const breaker = new CircuitBreaker(getRecs, { timeout: 800, errorThresholdPercentage: 50, resetTimeout: 10_000 });
breaker.fallback(() => cachedPopularItems());
const recs = await breaker.fire(userId);
```

PHP/Laravel has no first-party breaker. A cache-backed failure counter (`Cache::increment` with a TTL) that short-circuits above a threshold, or a package, paired with `Http::timeout()`, does the job.

## How backslop detects it

Review only. Don't add a breaker by default. Ask: is this call synchronous and user-facing, is the traffic high, and has this dependency failed slowly before? If all three are yes, propose a breaker with a fallback. Otherwise make sure the call has a timeout ([http-no-timeout](http-no-timeout.md)) and capped retries ([retry-without-backoff](retry-without-backoff.md)), and stop there.

## Sources

- Martin Fowler, "CircuitBreaker": https://martinfowler.com/bliki/CircuitBreaker.html
- Michael Nygard, *Release It!* (2nd ed.), ch. 5 "Stability Patterns" (Circuit Breaker, Fail Fast, Bulkheads) and ch. 4 (Cascading Failures).
- AWS Builders' Library, "Timeouts, retries, and backoff with jitter" (token-bucket retry limits): https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
