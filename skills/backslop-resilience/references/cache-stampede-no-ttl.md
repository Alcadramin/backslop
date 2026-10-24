# cache-stampede-no-ttl

**Cache-aside with no protection when a hot key expires, TTLs that all expire together, or no TTL at all.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$stats = Cache::remember('dashboard', 300, fn () => Stats::expensive());   // every request misses at once at expiry
Cache::forever("user:$id:profile", $profile);                              // stale forever, grows forever
```

```ts
let v = await redis.get(k);
if (!v) { v = await expensive(); await redis.set(k, v); }    // no TTL, no coalescing
```

## Why it hurts

When a hot key expires, or a deploy or flush empties the cache, every concurrent request misses at the same moment and runs the expensive query or API call. AWS calls this the thundering herd. It can throttle or brown out the dependency the cache was protecting, which is Nygard's Dogpile. Keys written with the same fixed TTL at the same moment (warmed at deploy) expire together. The opposite mistake, `Cache::forever` or Redis `SET` with no expiry on derived data, keeps stale data forever and grows the store without bound.

With one developer clicking around there's never a second request during the miss.

## Fix

Pick what the key needs:
- Serve stale while one request refreshes: Laravel `Cache::flexible` (stale-while-revalidate).
- Coalesce fills so only one per key is in flight: a per-process in-flight map, or an atomic lock (`Cache::lock`) when fills are very expensive.
- Add jitter to TTLs written in bulk. AWS applies jitter to timers and scheduled work generally.
- Give derived data a TTL. Cache errors separately with a short TTL (negative caching).

```php
$stats = Cache::flexible('dashboard', [300, 600], fn () => Stats::expensive());
Cache::put("user:$id:profile", $profile, 3600 + random_int(0, 300));
```

```ts
const inflight = new Map<string, Promise<string>>();
async function get(k: string) {
  const hit = await redis.get(k);
  if (hit) return hit;
  if (!inflight.has(k)) inflight.set(k, (async () => {
    try {
      const v = await expensive();
      await redis.set(k, v, 'EX', 300 + Math.floor(Math.random() * 60));
      return v;
    } finally { inflight.delete(k); }
  })());
  return inflight.get(k)!;
}
```

## When it's fine

- Truly immutable, content-addressed keys can live forever.
- Low-traffic keys or cheap fills: a stampede only matters for hot keys with expensive fills. Treat this as advice, not a defect.

## How backslop detects it

Review only. For each cache you add or change, ask: does it have a TTL? If it's hot and the fill is expensive, what happens at expiry when 100 requests miss at once? Were many keys written at the same moment with the same TTL?

## Sources

- AWS Builders' Library, "Caching challenges and strategies": https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns" (Dogpile).
- Laravel docs, Cache (`remember`, `flexible`, `forever`, atomic locks): https://laravel.com/docs/12.x/cache
- AWS Builders' Library, "Timeouts, retries, and backoff with jitter" (jitter on timers): https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
