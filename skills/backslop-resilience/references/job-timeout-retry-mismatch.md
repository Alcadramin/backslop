# job-timeout-retry-mismatch

**A queue job that can be retried while it's still running, or one retried many times with no backoff.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript

## What it looks like

```php
// config/queue.php: 'retry_after' => 90
class ExportReport implements ShouldQueue
{
    public $timeout = 600;     // longer than retry_after: a second worker picks it up mid-run
    public $tries = 50;        // and no backoff: 50 immediate retries against a down API
}
```

```ts
await queue.add('sync-order', { id }, { attempts: 20 });   // BullMQ: retried immediately
```

## Why it hurts

Laravel says a job's `$timeout` should always be shorter than its connection's `retry_after`. Otherwise the job may be handed to another worker while the first is still running, so two copies run at once and every side effect happens twice. The defaults are a 60 s job timeout and `retry_after` 90 for Redis. AWS describes the same failure with queue visibility timeouts: processing that runs past the visibility timeout is delivered to a second consumer in parallel. The other half of the mistake is `$tries = 50` (or `attempts: 20`) with no backoff, which turns a dependency outage into a retry storm. Laravel tries a job once by default, so agents raise `$tries` to make a flaky job pass.

Locally the job runs once, quickly, on one worker.

## Fix

```php
class ExportReport implements ShouldQueue
{
    public $timeout = 600;          // and set retry_after above 600 for this queue connection
    public $tries = 5;
    public function backoff(): array { return [10, 60, 300]; }
    public function middleware(): array { return [(new WithoutOverlapping($this->reportId))->expireAfter(900)]; }
}
```

```ts
await queue.add('sync-order', { id }, { attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
```

For SQS-style queues, set the visibility timeout above the p99 processing time, or extend it while working (`ChangeMessageVisibility`).

## When it's fine

- Jobs that are fully idempotent, where a duplicate run is harmless.
- Horizon or worker config that overrides timeouts per supervisor (check `config/horizon.php`).
- Many tries with `retryUntil()` and a backoff, for jobs that wait on a slow external process.

## How backslop detects it

- PHP: a `ShouldQueue` class with `public $tries` above 10 and no `$backoff`, `backoff()`, `retryUntil`, or `WithoutOverlapping` / `RateLimited` / `ThrottlesExceptions` middleware.
- JS/TS: `attempts:` above 3 in the options of a BullMQ `queue.add(` / `addBulk(` / `new Queue(` / `new Worker(` / `upsertJobScheduler(` call, with no `backoff` in the same call.

The `$timeout` versus `retry_after` check needs `config/queue.php` and the job file together, so it's review only: compare them whenever you raise `$timeout`.

## Sources

- Laravel docs, Queues (`$timeout`, `retry_after`, `$tries`, `backoff`, `WithoutOverlapping`): https://laravel.com/docs/12.x/queues
- AWS Builders' Library, "Avoiding insurmountable queue backlogs" (visibility timeout, heartbeating): https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs
- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
