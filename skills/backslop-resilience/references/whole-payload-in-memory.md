# whole-payload-in-memory

**Reading a whole file, download or export into memory, often by replacing code that streamed it.**

Severity: medium · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
// before: pipeline(fs.createReadStream(path), zlib.createGzip(), fs.createWriteStream(out))
const buf = await fs.promises.readFile(path);          // a 2 GB upload, all in memory
await fs.promises.writeFile(out, zlib.gzipSync(buf));
```

```python
# before: with requests.get(url, stream=True, timeout=30) as r: for chunk in r.iter_content(...)
data = requests.get(url, timeout=30).content
```

```php
// before: response()->streamDownload(...) reading with fgets()
$csv = file_get_contents($path);
return response($csv, 200, ['Content-Type' => 'text/csv']);
```

Agents do this to "simplify" streaming code into one readable line.

## Why it hurts

Memory now grows with the size of the data, not with the chunk size. One large file or a few concurrent exports and the container is OOM-killed, or PHP hits `memory_limit`. PHP's docs show the scale: building `range(0, 1000000)` as an array takes over 10 MB, the generator version under 1 KB. Node streams joined with `pipeline()` keep memory bounded by the buffer size. axios's `maxContentLength` is unlimited by default, so a large response is buffered whole.

Test fixtures are a few kilobytes.

## Fix

Keep streaming:

```ts
await pipeline(fs.createReadStream(path), zlib.createGzip(), fs.createWriteStream(`${path}.gz`));
// fetch: Readable.fromWeb(res.body) instead of await res.arrayBuffer() for large payloads
```

```python
with requests.get(url, stream=True, timeout=30) as r, open(dst, "wb") as f:
    for chunk in r.iter_content(1 << 16):
        f.write(chunk)
```

```php
return response()->streamDownload(function () {
    $out = fopen('php://output', 'w');
    Order::query()->lazyById(1000)->each(fn ($o) => fputcsv($out, [$o->id, $o->total]));
}, 'orders.csv');
```

## When it's fine

- Small config or template files read once at startup.
- Payloads with an enforced size cap (body-parser limit, upload max size), or JSON that must be parsed whole and is size-limited.

## How backslop detects it

Diff only: a removed streaming construct (`createReadStream`, `pipeline(`, `.pipe(`, `streamDownload(`, `StreamedResponse`, `StreamingHttpResponse`, `iter_content`, `iter_lines`, `stream=True`, `fgets`, `fgetcsv`, `SplFileObject`, `LazyCollection`, `getReader()`) not added back within 15 lines, and an added whole-payload read within 5 lines (`readFile`, `file_get_contents`, `.read()`, `.content`, `.text()`, `.arrayBuffer()`, `.blob()`, `Storage::get`, `->getContents()`) that uses the same variable (path, url) as the removed stream. Removed ORM batching (`chunk`, `lazy`, `cursor`) is covered by [unbounded-result-set](../../backslop-queries/references/unbounded-result-set.md).

Whole-file reads written from scratch aren't flagged: most are small files. Review them.

## Sources

- PHP manual, Generators overview (memory of `range()` versus a generator): https://www.php.net/manual/en/language.generators.overview.php
- Laravel docs, Lazy Collections: https://laravel.com/docs/12.x/collections#lazy-collections
- Node.js, "Backpressuring in Streams" (`pipeline()`): https://nodejs.org/en/learn/modules/backpressuring-in-streams
- Requests advanced usage, Body Content Workflow (`stream=True`, `iter_content`): https://requests.readthedocs.io/en/latest/user/advanced/
- axios request config (`maxContentLength` default -1): https://github.com/axios/axios/blob/v1.x/README.md
