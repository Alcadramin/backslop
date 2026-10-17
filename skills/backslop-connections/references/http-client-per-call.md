# http-client-per-call

**A new HTTP client, session or agent built for every call, so no connection is ever reused.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
foreach ($ids as $id) {
    $client = new \GuzzleHttp\Client();
    $client->get("https://api.example.com/items/$id");
}
```

```python
for id in ids:
    requests.get(f"{BASE}/items/{id}", timeout=5)    # no Session: a new connection each time
```

```ts
for (const id of ids) await fetch(url(id), { dispatcher: new Agent() });   // a new socket pool per call
```

## Why it hurts

Each new client throws away keep-alive. Every call pays DNS, TCP and TLS setup again, and the old sockets sit in TIME_WAIT. Over thousands of calls in a loop that can exhaust ephemeral ports or file descriptors. The SRE book lists running out of file descriptors as one way resource exhaustion turns into an outage. The requests docs say a `Session` reuses the underlying TCP connection when you call the same host repeatedly.

## Fix

```php
$client = new \GuzzleHttp\Client(['base_uri' => 'https://api.example.com', 'timeout' => 5, 'connect_timeout' => 2]);
foreach ($ids as $id) { $client->get("/items/$id"); }
```

```python
with requests.Session() as s:
    for id in ids:
        s.get(f"{BASE}/items/{id}", timeout=5)
```

```ts
const agent = new Agent({ keepAliveTimeout: 10_000 });   // once, at module scope
```

## When it's fine

- Laravel's `Http::` facade, which builds a new request object per call over a shared factory.
- One call per process run, such as a cron script.

## How backslop detects it

Review only. Look for:
- `new GuzzleHttp\Client(`, `new Agent(`, `axios.create(`, `requests.Session()` or `httpx.Client(` inside a loop or a request handler
- bare `requests.get/post(` inside a loop

## Sources

- Requests docs, Advanced Usage, "Session Objects" and "Keep-Alive": https://requests.readthedocs.io/en/latest/user/advanced/
- Google SRE book, ch. 22 "Addressing Cascading Failures" (file descriptor exhaustion): https://sre.google/sre-book/addressing-cascading-failures/
- undici docs, Client / Agent options: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md
