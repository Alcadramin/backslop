# ignored-backpressure

**Writing every chunk into another stream without waiting when it says it's full.**

Severity: medium · Detected by: scanner (static) · Languages: TypeScript/JavaScript

## What it looks like

```ts
src.on('data', (chunk) => dest.write(transform(chunk)));
for (const row of rows) res.write(toCsv(row));          // 1M rows, never waits for 'drain'
src.pipe(gzip).pipe(dest);                               // no error handling
```

## Why it hurts

`writable.write()` returns `false` once its buffer passes `highWaterMark` (16 KiB by default). Code is supposed to stop and wait for `'drain'`. A `'data'` handler that keeps writing piles everything the reader produces into memory whenever the destination is slower: a slow client, a slow disk, a throttled S3 upload. The Node guide measured the same job at about 88 MB max RSS with backpressure respected against about 1.5 GB without it. `.pipe()` does handle backpressure, but it doesn't forward errors or destroy the other streams on failure, which leaks file descriptors. `pipeline()` does both.

Locally the destination is as fast as the source, so the buffer never fills.

## Fix

```ts
import { pipeline } from 'node:stream/promises';
await pipeline(src, new Transform({ transform(c, _e, cb) { cb(null, transform(c)); } }), dest);

// when writing by hand
for (const row of rows) {
  if (!res.write(toCsv(row))) await once(res, 'drain');
}
```

## When it's fine

- Writing to `process.stdout` in a CLI with small output.
- Feeding a hash or cipher (`hash.update`, `cipher.write`) that consumes synchronously.
- Replying on the same socket in a request/response protocol: each reply is small and answers one message.

## How backslop detects it

A `.on('data', (chunk) => ...)` handler that writes that chunk to a different stream (`other.write(...chunk...)`), in a file with no `'drain'` and no `pipeline(`. Writes to `process.stdout`/`stderr`, hashes, ciphers and parsers, and writes back to the same stream the data came from, are skipped. Frontend paths are skipped.

Hand-written `for` loops of `res.write()` and bare `.pipe()` chains are left to review.

## Sources

- Node.js, "Backpressuring in Streams": https://nodejs.org/en/learn/modules/backpressuring-in-streams
- Michael Nygard, *Release It!* (2nd ed.), ch. 5 "Stability Patterns" (Create Back Pressure).
