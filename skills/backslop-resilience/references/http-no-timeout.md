# http-no-timeout

**An outbound HTTP call that can wait forever, or a timeout an agent removed.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$client = new \GuzzleHttp\Client();                       // timeout 0 = wait forever
$res = $client->get('https://api.example.com/quote');
```

```python
requests.post(url, json=body)                              # no timeout at all
```

```ts
export const billing = axios.create({ baseURL: BILLING }); // timeout 0
const r = await fetch(`${API}/quote`);                     // no overall deadline
```

The diff version: asked to fix "request timed out" errors, the agent deletes `'timeout' => 5`, `->timeout(3)` or `signal: AbortSignal.timeout(3000)`, and the error goes away because the call now just hangs.

## Why it hurts

A remote call that never answers holds the caller's worker, thread or connection while it waits. A few of them and the caller stops serving anyone, and the outage spreads upstream (Nygard: Integration Points, Blocked Threads, Cascading Failures). The library defaults don't save you:

| Client | Default |
|---|---|
| Guzzle | `timeout` 0 and `connect_timeout` 0: wait indefinitely |
| axios | `timeout: 0`: no timeout |
| Python requests | no timeout unless you pass one; the docs warn code "may hang for minutes or more" |
| Node `fetch` (undici) | no overall deadline; `headersTimeout` and `bodyTimeout` are 300 s each |
| Laravel `Http::` | 30 s timeout, 10 s connect timeout: bounded, but often longer than the caller can wait |
| Python httpx | 5 s of network inactivity |

Tests use mocks or a local server that answers in milliseconds, so nothing ever waits.

## Fix

Set a timeout on every call, sized from how long the upstream normally takes (AWS picks it from a high latency percentile such as p99.9) and from how long your own caller can wait.

```php
$client = new \GuzzleHttp\Client(['timeout' => 3, 'connect_timeout' => 1]);
$res = Http::connectTimeout(1)->timeout(3)->get('https://api.example.com/quote');
```

```python
requests.post(url, json=body, timeout=(3.05, 10))   # (connect, read)
```

```ts
const api = axios.create({ baseURL: API, timeout: 3_000 });
const r = await fetch(`${API}/quote`, { signal: AbortSignal.timeout(3_000) });
```

If the timeout fires in production, find out why the upstream is slow. Don't remove the timeout.

## When it's fine

- The timeout is set elsewhere: a shared client factory, `axios.defaults.timeout`, a Guzzle client built from config. Check that it really is.
- Long-poll, SSE and streaming downloads want an idle/read timeout rather than a short total one. They still need some bound.
- Laravel `Http::` without `->timeout()` is bounded at 30 s. That's acceptable in a queue job. In a request path, set a shorter one.
- CLI scripts a person runs and can Ctrl-C.

## How backslop detects it

Static (whole file, or added lines in diff mode):
- PHP: `new Client()` / `new \GuzzleHttp\Client([...])` with no options or an options array without `timeout`, in a file with no `'timeout'` / `RequestOptions::TIMEOUT` anywhere (so a per-request timeout counts). `new Client($config)` is skipped.
- Python: `requests.get/post/put/patch/delete/head/options/request(` with no `timeout=` and no `**kwargs`, in a file that imports `requests`.
- JS/TS: `axios.create({...})` with no `timeout` and no spread, outside frontend paths (`.tsx`, `components/`, `resources/js/`...).

Diff: a removed line that set a timeout (`'timeout' =>`, `->timeout(`, `Http::timeout(`, `timeout:`, `timeout=`, `AbortSignal.timeout(`, `signal:`, `CURLOPT_TIMEOUT`) with no timeout added back within 15 lines, while an HTTP call is still within 3 lines. Removing the whole call isn't flagged.

Not flagged statically: bare `fetch()` without `signal` (too common, and undici's 300 s limits bound it) and Laravel `Http::` without `->timeout()` (30 s default). Check those by review.

## Sources

- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns" (Integration Points, Blocked Threads, Slow Responses) and ch. 5 "Stability Patterns" (Timeouts).
- Guzzle request options (`timeout`, `connect_timeout` default 0): https://docs.guzzlephp.org/en/stable/request-options.html
- axios request config (`timeout` default 0): https://github.com/axios/axios/blob/v1.x/README.md
- Requests advanced usage, Timeouts: https://requests.readthedocs.io/en/latest/user/advanced/
- undici Client options (`headersTimeout`, `bodyTimeout`): https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md
- MDN `AbortSignal.timeout()`: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- Laravel HTTP client, Timeouts: https://laravel.com/docs/12.x/http-client
- HTTPX timeouts: https://www.python-httpx.org/advanced/timeouts/
- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
