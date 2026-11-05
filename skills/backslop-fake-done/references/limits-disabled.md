# limits-disabled

**A timeout, size limit or TLS check was turned off to make an error go away.**

Severity: high · Detected by: review only (in this skill) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
set_time_limit(0);
ini_set('memory_limit', '-1');
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
```

```ts
axios.create({ timeout: 0, maxContentLength: Infinity });
new https.Agent({ rejectUnauthorized: false });
```

```python
requests.get(url, verify=False)
```

## Why it hurts

During development, a request timed out, ran out of memory or hit a certificate error. Turning the limit off makes the error stop, and that's all it does. In production:
- A request with no time limit holds a worker until the client gives up.
- No memory limit lets one big import take the box down.
- TLS verification off accepts any certificate, so anyone on the network path can read and change the traffic.

No study read for this project measured how often agents do this.

## Fix

Raise the limit to a measured value, or move the work to a queue or a stream. Fix the certificate chain (install the CA, point `verify=` at the bundle) instead of disabling verification.

## When it's fine

- CLI commands and queue workers, where `set_time_limit(0)` is the norm for long jobs that have their own timeout at the queue level.
- Local-only tooling against a self-signed dev server, never shipped.

## How backslop detects it

Review only in this skill. Missing and zero timeouts on HTTP clients and database connections are covered by the connections and resilience research (patterns `http-no-timeout` and `no-db-timeouts`). When reviewing a diff, look for these added lines:
- `set_time_limit(0)`, `memory_limit` set to `-1`
- `timeout: 0`/`None`/`Infinity`, `maxContentLength: Infinity`
- `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED`, `verify=False`, `CURLOPT_SSL_VERIFYPEER` set to `false`
- removed `throttle` or rate-limiter middleware

## Sources

- Michael Nygard, *Release It!* (2nd ed.), ch. 5 "Stability Patterns", "Timeouts".
