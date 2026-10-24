---
name: backslop-resilience
description: Use when writing or changing code that calls external APIs, retries, handles webhooks or payments, fans out with Promise.all/gather, polls, streams files, caches in memory or runs queue jobs, or when asked to fix a timeout, a flaky call, or make it faster. Catches missing or removed timeouts, retries with no backoff or idempotency key, duplicate webhooks, unbounded fan-out and event-loop blocking.
---

# Resilience: every outbound call is bounded, every retry is safe, nothing grows without limit

This skill prevents code that works against a fast mock and fails against a real network: calls that hang forever, retries that charge a card twice, webhooks processed twice, and fan-out that opens 10,000 sockets at once. Agents fall into it because in a demo every dependency answers in a millisecond, fails at most once, and every list has five items. The failure shows only when a dependency is slow, a delivery is repeated, or the input is large.

## Use this when

- You add or change an HTTP client, SDK call, `fetch`, `axios`, Guzzle, `Http::`, `requests`, `httpx`.
- You add a retry: a loop, `->retry()`, `pRetry`, `tenacity`, urllib3 `Retry`, BullMQ `attempts`, Laravel `$tries`.
- You touch payment calls (charges, refunds, transfers, payouts) or a webhook handler.
- You write `Promise.all(x.map(...))`, `asyncio.gather(*...)`, `Http::pool`, or a polling loop.
- You read files, downloads or exports, or write to streams.
- You add an in-process cache, or `*Sync` / blocking calls in a Node or asyncio server.
- You're asked to **fix a timeout or a flaky call**. The tempting fixes are removing the timeout, adding retries with no delay, or retrying a POST. Each one hides the failure and makes it worse under load.
- You're asked to **make it faster or simpler**. The tempting fixes are deleting a `sleep` from a retry or poll, replacing a sequential loop with unbounded `Promise.all`, dropping an `await`, or replacing a stream with one `readFile`.

## Non-negotiable rules

1. Every outbound call has an explicit timeout. Never remove one to make an error go away.
2. Retries are capped, wait with exponential backoff plus jitter, and only retry transient errors.
3. Never retry a POST, charge, refund or send without a stable idempotency key stored with the record.
4. Every money-moving API call carries an idempotency key derived from the business operation, never a fresh UUID per call.
5. Webhook handlers record the event id (or make the effect an upsert) before acting, and answer 2xx fast.
6. Fan-out over a list whose size you don't control has a concurrency limit.
7. Polling loops sleep with backoff and have a deadline.
8. No sync fs/crypto/child_process calls in Node request handlers. No blocking calls inside `async def`.
9. Don't drop an `await` or a task reference to make something faster. Queue it instead.
10. Keep streaming code streaming, and keep size and TTL limits on caches.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-resilience
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

## Review checklist

**Each outbound call (HTTP, SDK, LLM, payment)**
- What's its timeout, and is it shorter than what its caller can wait? → [http-no-timeout](references/http-no-timeout.md)
- If it's retried: how many attempts, what delay, which errors? → [retry-without-backoff](references/retry-without-backoff.md)
- Does the retried call have side effects? What makes the repeat safe? → [retry-non-idempotent](references/retry-non-idempotent.md)
- Does it move money? Where is its idempotency key created and stored? → [outbound-payment-no-idempotency-key](references/outbound-payment-no-idempotency-key.md)
- Is it synchronous, user-facing, high-traffic and known to fail slowly? Only then consider a breaker. → [missing-circuit-breaker](references/missing-circuit-breaker.md)

**Each webhook handler**
- What happens when the same event arrives twice? → [webhook-no-dedupe](references/webhook-no-dedupe.md)
- Does anything slow run before the 2xx response? → [webhook-heavy-sync](references/webhook-heavy-sync.md)

**Concurrency and waiting**
- How many items can this `Promise.all` / `gather` / `Http::pool` start at once? → [unbounded-concurrency](references/unbounded-concurrency.md)
- Does this loop wait between status checks, and when does it give up? → [busy-poll-loop](references/busy-poll-loop.md)
- Is every promise or task awaited, queued, or kept with its errors handled? → [floating-promise-or-task](references/floating-promise-or-task.md)
- Does a request handler or `async def` make a blocking call? → [event-loop-blocking](references/event-loop-blocking.md)
- Are job `$tries`/`attempts` paired with backoff, and is the job timeout below `retry_after` / the visibility timeout? → [job-timeout-retry-mismatch](references/job-timeout-retry-mismatch.md)

**Memory**
- How big can this query result get? → [unbounded-result-set](../backslop-queries/references/unbounded-result-set.md)
- Is a whole file, download or export read into memory? Is its size capped? → [whole-payload-in-memory](references/whole-payload-in-memory.md)
- Does a stream copy respect `write()` returning false? → [ignored-backpressure](references/ignored-backpressure.md)
- Does each in-process cache have a max size and a TTL? → [unbounded-memory-cache](references/unbounded-memory-cache.md)
- What happens when a hot cache key expires under load? Does derived data have a TTL? → [cache-stampede-no-ttl](references/cache-stampede-no-ttl.md)

## Patterns

| Pattern | What goes wrong | Detected |
|---|---|---|
| [http-no-timeout](references/http-no-timeout.md) | One slow upstream hangs workers until the caller stops serving anyone | scanner + diff |
| [retry-without-backoff](references/retry-without-backoff.md) | Immediate retries from every caller keep a struggling dependency down | scanner + diff |
| [outbound-payment-no-idempotency-key](references/outbound-payment-no-idempotency-key.md) | A retried job or double click refunds or transfers twice | scanner + diff |
| [event-loop-blocking](references/event-loop-blocking.md) | One sync call stalls every other request on the process | scanner |
| [retry-non-idempotent](references/retry-non-idempotent.md) | A POST that timed out but succeeded runs again | scanner |
| [webhook-no-dedupe](references/webhook-no-dedupe.md) | A redelivered event grants, ships or emails twice | scanner |
| [unbounded-concurrency](references/unbounded-concurrency.md) | 10,000 items become 10,000 simultaneous requests | scanner |
| [busy-poll-loop](references/busy-poll-loop.md) | A status check hammers the dependency with no pause and no deadline | scanner + diff |
| [floating-promise-or-task](references/floating-promise-or-task.md) | Dropped work: lost on freeze, errors unseen, tasks garbage-collected | scanner (py) + diff |
| [job-timeout-retry-mismatch](references/job-timeout-retry-mismatch.md) | Many job retries with no backoff; a job runs twice at once | scanner |
| [ignored-backpressure](references/ignored-backpressure.md) | A slow destination makes memory grow with the input | scanner |
| [unbounded-memory-cache](references/unbounded-memory-cache.md) | Removed size/TTL: the cache grows until the process is killed | scanner diff |
| [whole-payload-in-memory](references/whole-payload-in-memory.md) | Stream replaced by a whole read: memory scales with file size | scanner diff |
| [unbounded-result-set](../backslop-queries/references/unbounded-result-set.md) | Every matching row loaded into memory (owned by backslop-queries) | scanner diff |
| [webhook-heavy-sync](references/webhook-heavy-sync.md) | A slow handler times out, the provider retries, duplicates pile up | review |
| [cache-stampede-no-ttl](references/cache-stampede-no-ttl.md) | A hot key expires and every request refills it at once | review |
| [missing-circuit-breaker](references/missing-circuit-breaker.md) | Every request waits out the timeout during an outage. Often overkill | review |

## Before you say done

State in your reply:
- For each outbound call you added or changed: its timeout, and its retry policy (attempts, backoff, which errors), or "no retry".
- For each retried or payment call with side effects: where the idempotency key comes from and where it's stored.
- For each webhook handler: how a duplicate delivery is detected, and what runs before the 2xx.
- For each fan-out or poll: the concurrency limit, or why the input is small. For polls, the delay and the deadline.
- If you removed a timeout, sleep, `await`, stream or cache bound: why, and what replaced it.
- The output of the diff check above, with every finding fixed or explained.
