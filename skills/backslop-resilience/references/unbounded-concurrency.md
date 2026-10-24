# unbounded-concurrency

**One concurrent request per item, however many items there are.**

Severity: medium · Detected by: scanner (static) · Languages: TypeScript/JavaScript, Python, PHP

## What it looks like

```ts
await Promise.all(userIds.map((id) => mailer.sendEmail(id)));    // 50k ids = 50k requests at once
```

```python
await asyncio.gather(*(fetch(u) for u in urls))
```

```php
$responses = Http::pool(fn (Pool $pool) => $ids->map(fn ($id) => $pool->get("$api/items/$id"))->all());
```

The agent's motivation is good: the sequential loop was slow. The result opens as many sockets as there are items.

## Why it hurts

10,000 items means 10,000 sockets, file descriptors and upstream requests in the same instant. The upstream throttles you or falls over, your own process runs out of file descriptors or memory, and every other request on the box waits behind the burst. Nygard calls this Unbalanced Capacities; the SRE book lists resource exhaustion as a path to cascading failure. `asyncio.gather` also keeps the other tasks running when one fails, so the rest keep hammering.

With five test items it's just fast.

The opposite slop exists too: `for (const id of ids) await send(id)` over 500 independent items is correct but N times slower. The fix for both is a limit.

## Fix

```ts
import pLimit from 'p-limit';
const limit = pLimit(10);
await Promise.all(userIds.map((id) => limit(() => mailer.sendEmail(id))));
```

```python
sem = asyncio.Semaphore(10)
async def bounded(u):
    async with sem:
        return await fetch(u)
async with asyncio.TaskGroup() as tg:      # cancels the others if one fails
    for u in urls:
        tg.create_task(bounded(u))
```

```php
$responses = Http::pool(fn (Pool $pool) => $ids->map(fn ($id) => $pool->get("$api/items/$id"))->all(), concurrency: 10);
```

For really large inputs, page through them and process one batch at a time, or put them on a queue.

## When it's fine

- A small, fixed list: `Promise.all([loadUser(), loadSettings()])`, or a constant list of regions.
- The input is bounded upstream (`take: 20`, a page, a validated array with a max length). Say so in a comment.
- Database calls through a pooled client: the pool queues the extra queries. backslop doesn't flag DB-only fan-out, but a pool of 10 serving a 10,000-item burst still delays every other request.

## How backslop detects it

- JS/TS: `Promise.all(` / `Promise.allSettled(` over `<name>.map(` whose callback makes a network call (`fetch`, `axios`, `got`, `ky`, `.post(`, `.request(`, `sendEmail`, `client.x(`, `api.x(`, S3 calls), with no limiter (`pLimit`, `limit(`, `Semaphore`, `chunk`, `batch`, `p-map`, `concurrency`, `PQueue`, `Bottleneck`) in the function. Lists named in ALL_CAPS are treated as constants. Frontend paths are skipped.
- Python: `asyncio.gather(*(call(x) for x in xs))` / `gather(*[call(x) for ...])` with no `Semaphore` in the function. Gathering tasks that already exist (`*[t.task for t in tasks]`) isn't flagged.
- PHP: `Http::pool(` whose body maps a collection (`->map(`, `array_map(`) with no `concurrency`.

It reports medium because the scanner can't see how big the list gets. Tell the reviewer the bound, or add the limiter.

## Sources

- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns" (Unbalanced Capacities, Self-Denial Attacks) and ch. 5 "Stability Patterns" (Bulkheads, Create Back Pressure).
- Google SRE book, ch. 22 "Addressing Cascading Failures" (resource exhaustion): https://sre.google/sre-book/addressing-cascading-failures/
- Python docs, Coroutines and Tasks (`gather`, `TaskGroup`): https://docs.python.org/3/library/asyncio-task.html
- Laravel HTTP client, Concurrent Requests (`pool`, `concurrency`): https://laravel.com/docs/12.x/http-client
