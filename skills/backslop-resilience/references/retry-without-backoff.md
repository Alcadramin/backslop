# retry-without-backoff

**Retries with no delay, no jitter or no cap: they hit a struggling dependency in lockstep.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
for (let i = 0; i < 5; i++) {
  try { return await api.get(`/quote/${sku}`); }
  catch (e) { if (i === 4) throw e; }            // straight into the next attempt
}
while (true) { try { await erp.post('/orders', o); break; } catch {} }   // no cap either
```

```php
Http::retry(3)->post($url, $body);               // sleep defaults to 0 ms
Http::retry(10, 0)->get($url);
```

```python
for attempt in range(5):
    try:
        return requests.get(url, timeout=5).json()
    except requests.RequestException:
        pass
```

The diff version: asked to make a slow test faster, the agent deletes the `sleep(...)` or the `Math.random()` from a retry loop.

## Why it hurts

AWS calls retries "selfish": each one spends the server's capacity to raise the caller's own chance of success. That's fine for a rare blip. In an overload, immediate retries from every caller arrive together and keep the dependency down. Jitter spreads them out. A cap or a retry budget stops a dependency failure from turning into a retry storm. Retries also multiply across layers: AWS's example of five layers retrying three times each multiplies database load by 243. The SRE book says to use randomized exponential backoff, limit retries per request, retry at one layer only, and never retry permanent errors.

In tests the mock fails once and succeeds on the next call, so a retry with no delay looks perfect.

## Fix

Cap the attempts, sleep with capped exponential backoff plus jitter, and retry only errors that can be transient (timeouts, connection errors, 429, 503).

```ts
for (let i = 0; ; i++) {
  try { return await api.get(`/quote/${sku}`); }
  catch (e) {
    if (i >= 3 || !isTransient(e)) throw e;
    await sleep(Math.random() * Math.min(10_000, 200 * 2 ** i));   // full jitter
  }
}
```

```php
Http::timeout(3)->retry(3, fn (int $attempt) => random_int(0, 200 * 2 ** $attempt))->get($url);
Http::timeout(3)->retry([200, 600, 1500], when: fn ($e) => $e instanceof ConnectionException)->get($url);
```

```python
for attempt in range(4):
    try:
        return requests.get(url, timeout=5).json()
    except requests.ConnectionError:
        if attempt == 3:
            raise
        time.sleep(random.uniform(0, min(10, 0.2 * 2**attempt)))
```

If a library already retries with backoff (AWS SDK, Stripe SDK `maxNetworkRetries`), don't wrap it in a second retry loop.

## When it's fine

- A single-instance CLI or a one-off script where nobody else is retrying at the same moment.
- Failover across different hosts (`for host of hosts`): each host is tried once. backslop doesn't flag loops over a list.
- Retrying a local, cheap operation (an optimistic-lock conflict on the same row) where the conflict, not overload, is the reason.

## How backslop detects it

Static:
- A counted or infinite loop (`for (i = 0; i < 5 ...)`, `for (;;)`, `while (true)`, `while (attempts < max)`, `for _ in range(5)`, `while True`) that contains a `try` whose success path leaves the loop (`return` / `break`) around a network call (`fetch`, `axios`, `Http::`, `requests.`, `httpx.`, `->get/post(`, `client.x(`), and has no `sleep`, `usleep`, `setTimeout`, `delay`, `wait`, `backoff`, `asyncio.sleep`, `await new Promise` anywhere in the loop. Loops over a list of items aren't retry loops and aren't flagged.
- Laravel `Http::...->retry(n)` or `->retry(n, 0)`.

Diff: a removed delay call or jitter (`Math.random`, `random_int`, `random.uniform`, `jitter`) inside a retry loop or next to `->retry(`, not added back within 10 lines. Jitter counts as removed only when the new delay is a fixed literal, since a helper like `backoff(i)` may add its own.

## Sources

- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Google SRE book, ch. 22 "Addressing Cascading Failures" (retries): https://sre.google/sre-book/addressing-cascading-failures/
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns" (Dogpile, Chain Reactions).
- Laravel HTTP client, Retries (`retry(times, sleepMilliseconds | closure | array, when)`): https://laravel.com/docs/12.x/http-client
