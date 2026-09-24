# chunk-mutating-filter-column

**`chunk()` over a filter while the callback changes the filtered column: rows get skipped.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP

## What it looks like

```php
User::where('migrated', false)->chunk(100, function ($users) {
    foreach ($users as $u) {
        $u->update(['migrated' => true]);
    }
});
```

An agent "simplifies" `chunkById` to `chunk`, or writes this from scratch. The same thing happens with query builder `each()`, which pages with `chunk()` under the hood:

```php
DB::table('users')
    ->whereNull('api_key')
    ->orderBy('id')
    ->each(function (object $row): void {
        DB::table('users')->where('id', $row->id)->update(['api_key' => Str::uuid()]);
    });
```

backslop found this second shape in a migration of an open-source Laravel app. With more users than the chunk size, it leaves some of them without a key.

## Why it hurts

`chunk()` pages with OFFSET. When the callback changes the column in the WHERE clause, the matched set shrinks under the cursor. Page 2 starts at offset 100 of a smaller set and skips 100 rows that still match. Half the rows are never processed, nothing throws, and the job reports success. With fewer rows than one chunk, as in most tests, everything looks fine. Laravel's docs warn about exactly this.

## Fix

```php
User::where('migrated', false)->chunkById(100, function ($users) {
    foreach ($users as $u) { $u->update(['migrated' => true]); }
});

// No per-row logic? One statement:
User::where('migrated', false)->update(['migrated' => true]);
```

`chunkById` and `lazyById` page by `id > last id`, so a shrinking set does not shift pages. They add their own where conditions, so group your own `orWhere` in a closure: `->where(fn ($q) => $q->where('a', 1)->orWhere('b', 1))->chunkById(...)`.

## When it's fine

- The callback only reads, or writes columns that are not in the filter.
- `whereNotNull('col')` and the callback writes a new non-null value: the set does not shrink.
- The callback writes another table that happens to have a column with the same name.
- `->get()->chunk(100)` splits a collection that is already loaded. That is not a query.

## How backslop detects it

Static, on the whole file:
- It finds builder `->chunk(n, function ...)`, `->each(function ...)` and `->lazy(...)->each(...)`.
- It reads the filter columns from the `where`/`whereNull`/`whereIn`/... calls earlier in the same statement.
- It reports when the callback writes one of those columns to the iterated rows: inside `->update([... 'col' => ...])`, as `$row->col = ...`, through `->increment('col')`, or by deleting the row.
- For `whereNotNull('col')` it reports only when the callback sets `col` to null.
- It skips `chunkById`/`lazyById`, `each()` after `lazyById()`/`cursor()`/`get()`, and collections.

Diff: a removed `chunkById(`/`lazyById(`/`eachById(` replaced within 3 lines by `chunk(`/`lazy(`/`each(`, with no `ById` added back within 15 lines and a callback that writes (`update`, `save`, `delete`, `increment`). A read-only callback is not reported.

## Sources

- Laravel docs, Eloquent, "Chunking Results" (use `chunkById` when updating the filtered column; same for `lazy` vs `lazyById`; group conditions in a closure): https://laravel.com/docs/12.x/eloquent#chunking-results
- Laravel docs, Query Builder, "Chunking Results": https://laravel.com/docs/12.x/queries#chunking-results
- Doctrine ORM docs, "Batch Processing": https://www.doctrine-project.org/projects/doctrine-orm/en/3.6/reference/batch-processing.html
