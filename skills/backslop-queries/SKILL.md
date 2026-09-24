---
name: backslop-queries
description: Catches database query regressions in agent-written backend code - removed pagination or LIMIT, filtering, counting or summing in PHP/JS/Python instead of SQL, N+1 queries in loops, dropped eager loading, chunk() skipping rows, per-row writes, string-built SQL. Use when asked to optimize, speed up, simplify or fix code that queries a database, or on "slow", "timeout", "N+1", "memory".
---

# backslop-queries: the database does the work, and every list query has a bound

The classic regression: an agent is asked to "optimize" an endpoint, sees many queries or a `paginate()`, removes the bound, loads the whole table with `->get()` and then filters, sorts or counts in PHP. It looks like fewer queries and it passes the tests, because test tables hold 50 rows. In production it loads millions of rows per request, or skips half the rows of a batch job, and still reports success. This skill is the set of rules that stop that.

## Use this when

- You are asked to **optimize, speed up, reduce queries, simplify or clean up** code that reads or writes a database. This is when bounds, eager loads and batching get removed.
- You are fixing a **slow endpoint, a timeout, a memory limit or an N+1** report.
- You write or change any query, ORM call, pagination, batch job, migration-time data fix or raw SQL.
- You review a diff that touches Eloquent / Query Builder / PDO, Prisma / Knex / TypeORM, Django ORM / SQLAlchemy.

## Non-negotiable rules

1. **Never remove a bound to reduce the query count.** Keep `paginate` / `cursorPaginate` / `limit` / `take` / `chunkById` / `lazyById` / slicing. Fewer queries that each load the whole table is a regression.
2. **Push filter, sort, count, exists and aggregate into SQL.** `where` / `orderBy` / `count()` / `exists()` / `sum()` / `groupBy` on the query, never on `->get()`, `findMany()` or a list built from a queryset.
3. **When a batch job updates the column it filters on, use `chunkById` / `lazyById`, never `chunk` / `lazy` / builder `each`.** OFFSET paging over a shrinking set skips rows. Better still, one set-based `UPDATE` when no per-row logic is needed.
4. **No query inside a loop.** Fetch once before the loop (`whereIn`, `{ in: ids }`, `__in`, `in_bulk`) or eager-load (`with`, `include`, `select_related` / `prefetch_related`), then look rows up in a map.
5. **Never drop an eager load while the code still reads that relation,** and never remove a lazy-loading guard (`preventLazyLoading`, `raiseload`, `nplusone` raise) to make an error go away.
6. **Write in bulk** (`upsert`, `insert($rows)`, `createMany`, `bulk_create`, `qs.update()`) unless model events, observers or signals must fire. If they must, say so.
7. **Never splice a value into SQL text.** Bind it (`?`, `:name`, tagged `$queryRaw`, `execute(sql, params)`). Identifiers you cannot bind go through an allowlist.
8. **Keep cursor pagination when it is there.** Do not swap it for OFFSET to make page numbers easy.
9. **Prove the shape on realistic data, not on the test row count.** State each list query's bound and the index it uses.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-queries
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

## Review checklist

Ask these about every query you wrote or changed. The scanner catches some; the rest need you.

**Bounds and batching**
- Does every list query have a bound (page, limit, chunk, cursor, slice)? Did I remove one? [unbounded-result-set](references/unbounded-result-set.md)
- Is a batch job paging with OFFSET while it changes the filtered column? [chunk-mutating-filter-column](references/chunk-mutating-filter-column.md)
- Do LIMIT/OFFSET batches and pages order by a unique key? [unstable-order-batching](references/unstable-order-batching.md)
- Did I replace cursor pagination with `paginate()` / `skip` / OFFSET on a big or growing table? [deep-offset-pagination](references/deep-offset-pagination.md)
- Does my `cursor()` / `iterator()` / `yield_per` really stream on this driver, and can it still eager load? [fake-streaming](references/fake-streaming.md)
- Am I caching a whole table or an unbounded result? [cache-whole-table](references/cache-whole-table.md)

**Work the database should do**
- Do I filter or sort rows after fetching them? [filter-sort-in-app](references/filter-sort-in-app.md)
- Do I sum, average, group or reduce rows in code? [aggregate-in-app](references/aggregate-in-app.md)
- Do I load rows only to count them? [count-by-fetching](references/count-by-fetching.md)
- Do I count or load rows only to test existence? [exists-by-count-or-fetch](references/exists-by-count-or-fetch.md)
- Do I load many rows to use one (first, last, random)? [fetch-all-to-take-one](references/fetch-all-to-take-one.md)
- Do I hydrate full models to read one or two columns? [select-star-overfetch](references/select-star-overfetch.md)

**Query count**
- Is there a query (or a relation method like `$x->posts()->count()`) inside a loop or a per-item callback? [n-plus-one-query-in-loop](references/n-plus-one-query-in-loop.md)
- Does the loop read a relation that is not eager loaded, or did I remove a `with` / `include` / `select_related`? [n-plus-one-lazy-relation](references/n-plus-one-lazy-relation.md)
- Do templates, API resources or serializers query per item? [n-plus-one-in-view-or-serializer](references/n-plus-one-in-view-or-serializer.md)
- Did I fix N+1 by eager loading relations nobody renders? [overeager-loading](references/overeager-loading.md)
- Do I load a related model only to read its id? [load-relation-for-fk](references/load-relation-for-fk.md)
- Do I pass thousands of ids from one query into `whereIn` of another? [huge-in-list](references/huge-in-list.md)

**Writes and correctness**
- Do I insert, update or delete one row per statement in a loop? [row-by-row-writes](references/row-by-row-writes.md)
- Do I read a value, change it in code and save it back (stock, balance, counters)? [read-modify-write](references/read-modify-write.md)
- Did I add a top-level `orWhere` next to a tenant or owner condition? [or-chain-and-ungrouped-or](references/or-chain-and-ungrouped-or.md)
- Did I add `DISTINCT` to hide duplicate rows from a join? [distinct-hides-bad-join](references/distinct-hides-bad-join.md)
- Is any value concatenated or interpolated into SQL? [string-built-sql](references/string-built-sql.md)

**Indexes and predicates**
- Does every new `where` / `orderBy` / join column have an index that the planner uses (check `EXPLAIN` on realistic data)? [missing-index-for-new-predicate](references/missing-index-for-new-predicate.md)
- Is the column wrapped in a function or math (`DATE(col)`, `LOWER(col)`, `whereDate`)? [non-sargable-function-on-column](references/non-sargable-function-on-column.md)
- Is a string column compared to a number, or a value bound with the wrong type? [implicit-type-conversion](references/implicit-type-conversion.md)
- Is search a `LIKE '%term%'`? [leading-wildcard-like](references/leading-wildcard-like.md)
- Is there `ORDER BY RAND()` / `inRandomOrder()` / `order_by('?')`? [order-by-random](references/order-by-random.md)
- Do optional filters use `(:x IS NULL OR col = :x)`? [catch-all-optional-filter](references/catch-all-optional-filter.md)

## Patterns

| Pattern | What goes wrong | Detected |
|---|---|---|
| [unbounded-result-set](references/unbounded-result-set.md) | Bound removed, every row loaded | scanner diff |
| [filter-sort-in-app](references/filter-sort-in-app.md) | Rows fetched, then filtered or sorted in code | scanner |
| [aggregate-in-app](references/aggregate-in-app.md) | Sum/group/reduce in code instead of SQL | scanner |
| [count-by-fetching](references/count-by-fetching.md) | `->get()->count()`, `len(qs)`, `findMany().length` | scanner |
| [exists-by-count-or-fetch](references/exists-by-count-or-fetch.md) | Existence via count or loaded rows | scanner |
| [fetch-all-to-take-one](references/fetch-all-to-take-one.md) | All rows loaded to keep one | scanner |
| [n-plus-one-query-in-loop](references/n-plus-one-query-in-loop.md) | One query per loop iteration | scanner |
| [n-plus-one-lazy-relation](references/n-plus-one-lazy-relation.md) | Eager load or lazy-loading guard removed | scanner diff |
| [n-plus-one-in-view-or-serializer](references/n-plus-one-in-view-or-serializer.md) | Queries per item in templates, resources, serializers | review |
| [select-star-overfetch](references/select-star-overfetch.md) | Full models or rows for a few columns | scanner (PHP pluck), review |
| [overeager-loading](references/overeager-loading.md) | Eager loading relations nobody uses | review |
| [deep-offset-pagination](references/deep-offset-pagination.md) | Cursor pagination swapped for OFFSET | scanner diff |
| [chunk-mutating-filter-column](references/chunk-mutating-filter-column.md) | `chunk()` skips rows while updating its filter column | scanner + scanner diff |
| [unstable-order-batching](references/unstable-order-batching.md) | Batches or pages without a unique ORDER BY | review |
| [fake-streaming](references/fake-streaming.md) | "Streaming" APIs that still buffer everything | review |
| [missing-index-for-new-predicate](references/missing-index-for-new-predicate.md) | New WHERE/JOIN/ORDER BY column without an index | review |
| [non-sargable-function-on-column](references/non-sargable-function-on-column.md) | Function or math on the column defeats the index | review |
| [implicit-type-conversion](references/implicit-type-conversion.md) | Column compared to a value of another type | review |
| [leading-wildcard-like](references/leading-wildcard-like.md) | `LIKE '%term%'` scans every row | scanner |
| [or-chain-and-ungrouped-or](references/or-chain-and-ungrouped-or.md) | OR chains instead of IN; ungrouped `orWhere` leaks rows | review |
| [catch-all-optional-filter](references/catch-all-optional-filter.md) | `(:x IS NULL OR col = :x)` forces a generic plan | review |
| [huge-in-list](references/huge-in-list.md) | Thousands of ids from one query bound into another | review |
| [row-by-row-writes](references/row-by-row-writes.md) | One INSERT/UPDATE/DELETE per row | scanner |
| [read-modify-write](references/read-modify-write.md) | Lost updates from read, change, save | review |
| [string-built-sql](references/string-built-sql.md) | Values spliced into SQL text | scanner |
| [distinct-hides-bad-join](references/distinct-hides-bad-join.md) | `DISTINCT` hides a row-multiplying join | review |
| [order-by-random](references/order-by-random.md) | Sorts the whole table to pick a few rows | scanner |
| [load-relation-for-fk](references/load-relation-for-fk.md) | Loads a relation to read an id the row has | review |
| [cache-whole-table](references/cache-whole-table.md) | Caches an entire table or unbounded result | review |

## Before you say done

State this evidence in your final reply, one line per query you added or changed:

- **Bound:** the page size, limit, chunk size or slice, or why the table is small and fixed.
- **Where the work happens:** each filter, sort, count, exists and aggregate is in SQL. If one runs in code, the row count it runs on.
- **Query count:** how many queries the endpoint or job runs for N items (for example "2 queries for any page size"), and how you know: `assertNumQueries`, `preventLazyLoading`, query log, Debugbar/Telescope.
- **Batch jobs:** `chunkById` / `lazyById` / keyset loop, and whether the job changes its own filter column.
- **Index:** the index each new predicate or sort uses, from `EXPLAIN` on realistic data, or "no index needed" with the reason.
- **Raw SQL:** every value is bound; every interpolated identifier is allowlisted.
- **Scanner:** the `backslop diff --skill backslop-queries` result, and why any remaining finding is a false positive.
