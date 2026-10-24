# busy-poll-loop

**A loop that checks a status over and over with no sleep, no backoff and no deadline.**

Severity: medium · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
let job = await api.getJob(id);
while (job.status === 'running') job = await api.getJob(id);
```

```php
while (Http::get("$api/jobs/$id")->json('status') === 'running') {}
```

```python
while client.get_status(job_id) == "running":
    pass
```

The diff version: asked to make a test faster, the agent deletes the `sleep(1000)` from the loop.

## Why it hurts

The loop calls the dependency as fast as the network allows and burns CPU while doing it. Multiply by every client waiting on a job and it's a self-made load spike, arriving exactly when the dependency is already slow. With no deadline, a job that never finishes holds a worker forever. AWS recommends backoff with jitter and a capped number of tries for any repeated attempt; the SRE book's limit on retries per request applies to polls too.

In tests the mock reports "done" on the second call.

## Fix

```ts
const deadline = Date.now() + 120_000;
for (let i = 0; ; i++) {
  const s = await api.getJob(id);
  if (s.status !== 'running') return s;
  if (Date.now() > deadline) throw new Error('job timed out');
  await sleep(Math.min(10_000, 500 * 2 ** i) * (0.5 + Math.random() / 2));
}
```

```php
// in a queue job: release it with a delay instead of blocking the worker
if ($status === 'running') { $this->release(min(60, 5 * 2 ** $this->attempts())); return; }
```

```python
for attempt in range(20):
    if client.get_status(job_id) != "running":
        break
    time.sleep(min(30, 0.5 * 2**attempt) * random.uniform(0.5, 1))
else:
    raise TimeoutError
```

Better still, if the provider offers a webhook or callback, use it instead of polling.

## When it's fine

- Blocking reads that wait server-side: `BLPOP`, SQS `receiveMessage` with `WaitTimeSeconds`, a stream `reader.read()`.
- Loops whose body does real work each pass and only checks a status to decide whether to continue.
- Pagination loops (`cursor`, `hasMore`, `next_page`).

## How backslop detects it

Static: a `while` / `do ... while` / `for (;;)` / `while True` loop whose condition or body mentions a state word (`status`, `state`, `ready`, `done`, `pending`, `running`, `processing`, ...) and makes a call (`fetch`, `axios`, `Http::`, `->get(`, `.get(`, `.retrieve(`, `getStatus(`, `check...(`, `poll...(`, `requests.x(`), whose body only re-reads the status (assignments, `if`/`break`/`throw`, logging), and that has no `sleep`, `usleep`, `setTimeout`, `delay`, `wait`, `backoff`, `asyncio.sleep`, `->release(`. Blocking reads (`.read(`, `BLPOP`, `receive_message`, `WaitTimeSeconds`) and pagination tokens exempt the loop.

Diff: a removed delay call, not added back within 10 lines, inside a loop that now matches the shape above.

## Sources

- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Google SRE book, ch. 22 "Addressing Cascading Failures": https://sre.google/sre-book/addressing-cascading-failures/
- Michael Nygard, *Release It!* (2nd ed.), ch. 5 "Stability Patterns" (Timeouts).
- Laravel docs, Queues (releasing a job back onto the queue): https://laravel.com/docs/12.x/queues
