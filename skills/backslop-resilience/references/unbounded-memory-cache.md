# unbounded-memory-cache

**An in-process `Map`, dict or static array used as a cache with no size limit or expiry.**

Severity: medium · Detected by: scanner (diff) · Languages: TypeScript/JavaScript, Python, PHP

## What it looks like

```ts
const cache = new Map<string, User>();          // keyed by user id, never evicted
export async function getUser(id: string) {
  if (!cache.has(id)) cache.set(id, await db.user.findUnique({ where: { id } }));
  return cache.get(id);
}
```

```python
@functools.lru_cache(maxsize=None)              # was maxsize=4096
def rate_for(user_id): ...
```

```php
class PriceService { private static array $cache = []; }   // in Octane or a queue worker: lives forever
```

The diff version: the agent drops `max:` / `ttl:` from an `LRUCache` or changes `maxsize=4096` to `maxsize=None` to "improve the hit rate".

## Why it hurts

A cache keyed by user, URL or product id grows for the life of the process. That's a memory leak with a nice name. As the heap grows, GC pauses get longer, latency rises, and eventually the process is OOM-killed. The SRE book describes how memory pressure feeds latency until the service falls over. Nygard's Steady State pattern says anything that accumulates needs a purge mechanism, and AWS says every cache needs a deliberate size, eviction policy and TTL. Under PHP-FPM a static array dies with the request; under Octane, Swoole, RoadRunner or a queue worker it lives as long as the worker.

The test process lives for seconds and touches ten keys.

## Fix

```ts
import { LRUCache } from 'lru-cache';
const cache = new LRUCache<string, User>({ max: 5_000, ttl: 60_000 });
```

```python
@functools.lru_cache(maxsize=4096)
def rate_for(user_id): ...
```

```php
$price = Cache::remember("price:$id", 300, fn () => $this->load($id));   // shared store with a TTL
```

## When it's fine

- Keys come from a small fixed domain: enum values, config keys, a handful of tenants.
- A `WeakMap` keyed by objects, which drops entries with their keys.
- Short-lived CLI processes.

## How backslop detects it

Diff only: a removed size or TTL bound (`max:`, `maxSize`, `maxsize=`, `max_size`, `maxEntries`, `ttl:`, `maxAge`, `stdTTL` with a number) on a line about a cache (`cache`, `LRU`, `lru_cache`, `TTLCache`, `NodeCache` on the line or within 3 lines), with no bound added back within 10 lines. Changing the numbers isn't flagged. A new unbounded `Map` cache isn't flagged statically, because the key domain decides whether it's a problem. Review those.

## Sources

- Michael Nygard, *Release It!* (2nd ed.), ch. 5 "Stability Patterns" (Steady State).
- Google SRE book, ch. 22 "Addressing Cascading Failures" (memory exhaustion): https://sre.google/sre-book/addressing-cascading-failures/
- AWS Builders' Library, "Caching challenges and strategies": https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies
