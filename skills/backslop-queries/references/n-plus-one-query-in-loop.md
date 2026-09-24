# n-plus-one-query-in-loop

**A query inside a loop: one database round trip per item.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Agents write this by calling a repository's `find($id)` for each item, or by fetching a related row per item instead of joining.

```php
foreach ($orderIds as $id) {
    $order = Order::find($id);                                            // N queries
    $user  = DB::table('users')->where('id', $order->user_id)->first();  // N more
}
$users->each(fn (User $u) => $u->posts()->count());                       // one COUNT per user
```

```ts
for (const p of posts) {
  p.author = await prisma.user.findUnique({ where: { id: p.authorId } });
}
const comments = await Promise.all(posts.map((p) => prisma.comment.findMany({ where: { postId: p.id } })));
```

```python
for oid in order_ids:
    order = Order.objects.get(pk=oid)
```

## Why it hurts

One query lists N parents, then the loop runs one more query per parent. Each round trip has fixed latency (network, parse, plan), so latency adds up: 500 rows at 2 ms each adds a second. Azure's Chatty I/O example ran 45 SELECTs for one request, and under load the median response went to tens of seconds. Folding it into one query raised throughput from about 410 to about 3,970 requests per minute. Running the per-item queries in parallel with `Promise.all` hides the latency, but the database and the connection pool still get N queries. With three test rows the loop is fast, so the agent reports success.

## Fix

Fetch once before the loop, then look rows up from a map.

```php
$orders = Order::with('user')->whereIn('id', $orderIds)->get();   // 2 queries
$users  = User::withCount('posts')->whereIn('id', $ids)->get();   // posts_count, no loop query
```

```ts
const authors = await prisma.user.findMany({ where: { id: { in: posts.map((p) => p.authorId) } } });
const byId = new Map(authors.map((a) => [a.id, a]));
for (const p of posts) p.author = byId.get(p.authorId);
// or: prisma.post.findMany({ take: 20, include: { author: true } })
```

```python
orders = Order.objects.in_bulk(order_ids)     # one query, dict by pk
```

A `whereIn` over the ids of a bounded page (20 to 500 ids) is the right answer here. See [huge-in-list](huge-in-list.md) for when the id list itself is unbounded. For relations read as properties (`$book->author`), see [n-plus-one-lazy-relation](n-plus-one-lazy-relation.md). For loops in templates and serializers, see [n-plus-one-in-view-or-serializer](n-plus-one-in-view-or-serializer.md). Writes per item are [row-by-row-writes](row-by-row-writes.md).

## When it's fine

- The loop runs a known handful of times: three fixed statuses, a retry loop.
- A batch loop: one query per chunk of 1,000 ids, or a keyset `while` loop that fetches the next page.
- A tree walk that runs one query per level, not per node.
- A deliberate per-item lock (`select_for_update()` per row in its own transaction). Say so in a comment.

## How backslop detects it

A static rule. It finds read queries whose innermost enclosing scope runs per item: `for`/`foreach`, `.map`/`.forEach`/`.filter` callbacks, Laravel `->each(function ...)` / `->map(fn ...)`, `array_map` callbacks and Python comprehensions. Queries it recognizes:
- PHP: `Model::find/findOrFail/first/count/pluck/all(...)`, `Model::where/query/with(...)` chains that end in a read (`get`, `first`, `count`, `exists`, `pluck`...), `DB::table(...)` reads, `DB::select/selectOne`, `$loopVar->relation()->count()`/`->get()`, and `$pdo->query('SELECT ...')`.
- JS/TS: Prisma `x.y.findUnique/findFirst/findMany(...)` and `count/aggregate/groupBy` on a Prisma-like client, TypeORM/Mongoose `findOne/findOneBy/findBy/findById(...)`, knex `db('table')` reads, and `pool.query('SELECT ...')`.
- Python: `Model.objects.get/filter/...`, SQLAlchemy `session.execute/scalars/query/get(Model, ...)`, `cursor.execute("SELECT ...")`, and `loopVar.x_set.filter(...)` / `loopVar.rel.filter(...)`.

It does not report:
- `while`/`do` loops (paging, tree walks, polling) and loops over chunks or batches (`array_chunk`, `*_batches(...)`, `as $chunk`),
- counter loops that page with a bounded fetch (`for (let skip = 0; ; skip += 500)` with `take`/`skip`, `for page in range(n)` with a slice),
- loops over a literal list or a single-digit count,
- the iterable of a comprehension or the list argument of `array_map`, which run once,
- closures defined inside a loop but not called there,
- Prisma `findUnique` inside a callback: Prisma batches `findUnique` calls made in the same tick. It does not batch `findFirst` or `findMany`, and an awaited `findUnique` in a `for` loop is still sequential,
- non-model helpers (`Arr::where`, `Cache::get`), and canvas-style `findOne('#id')` string lookups,
- tests, migrations, seeders and factories.

HTTP calls per iteration are the same family of problem, but this skill's rule only looks at database calls.

## Sources

- Microsoft Azure Architecture Center, "Chatty I/O antipattern": https://learn.microsoft.com/azure/architecture/antipatterns/chatty-io/
- Prisma docs, "Query optimization", "Solving the n+1 problem": https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance
- Django docs, "Use QuerySet.select_related() and prefetch_related()": https://docs.djangoproject.com/en/5.2/topics/db/optimization/
- Laravel docs, Eloquent Relationships, "Eager Loading": https://laravel.com/docs/12.x/eloquent-relationships#eager-loading
- Runtime detectors: beyondcode/laravel-query-detector https://github.com/beyondcode/laravel-query-detector , nplusone https://github.com/jmcarp/nplusone
