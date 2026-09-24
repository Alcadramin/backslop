# deep-offset-pagination

**Cursor (keyset) pagination replaced by OFFSET pagination on a large or growing table.**

Severity: medium · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

An agent "simplifies" a feed endpoint back to page numbers:

```php
// before
return PostResource::collection(Post::orderByDesc('id')->cursorPaginate(20));
// after
return PostResource::collection(Post::latest()->paginate(20));   // page=10000 -> OFFSET 199980
```

```ts
// before: ...(cursor && { cursor: { id: cursor }, skip: 1 })
prisma.post.findMany({ take: 20, orderBy: { id: 'desc' }, skip: (page - 1) * 20 });
```

```python
Post.objects.order_by("-id")[offset:offset + 20]
```

## Why it hurts

`LIMIT 20 OFFSET 200000` makes the database produce and throw away 200,000 rows before it returns 20. PostgreSQL's docs note that rows skipped by OFFSET still have to be computed inside the server. Each page is slower than the last. Offsets also drift: an insert or delete between requests makes users see a row twice or miss one. Keyset pagination filters on an index (`WHERE (created_at, id) < (?, ?)`) and costs the same at any depth. Laravel's `paginate()` also runs a `COUNT(*)` for the total.

## Fix

```php
Post::orderByDesc('id')->cursorPaginate(20);
```

```ts
prisma.post.findMany({ take: 20, orderBy: { id: 'desc' }, ...(cursor && { cursor: { id: cursor }, skip: 1 }) });
```

```sql
SELECT id, title FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC LIMIT 20;   -- index on (created_at, id)
```

```python
Post.objects.filter(id__lt=last_id).order_by("-id")[:20]
```

Keyset needs a unique order (add the primary key as a tiebreaker). It cannot jump to page N, so it fits feeds, infinite scroll, APIs and exports. MySQL can evaluate row values but cannot use them as index access predicates; Winand shows the equivalent AND/OR form.

## When it's fine

- Admin back-offices with numbered pages over modest tables.
- Search results capped at a few pages. `paginate()` is the idiomatic Laravel default there.
- The product needs "jump to page 37".

## How backslop detects it

A diff rule. It reports a removed keyset signal:
- `cursorPaginate(`, Prisma `cursor:`, Django `id__lt=`/`id__gt=`,
- `where('id', '<', ...)`, or `WHERE ... id < ?` in SQL,

when an OFFSET-style call is added within 8 lines (`paginate(`, `simplePaginate(`, `skip(`/`skip:`, `offset(`, `OFFSET`, `forPage(`, a Django slice with a computed start) and no keyset signal is added back within 15 lines. Deleting the whole query is not reported.

Whether the table is large and whether users reach deep pages is for review.

## Sources

- Markus Winand, "We need tool support for keyset pagination": https://use-the-index-luke.com/no-offset
- Use The Index, Luke, "Paging Through Results": https://use-the-index-luke.com/sql/partial-results/fetch-next-page
- PostgreSQL docs, "LIMIT and OFFSET": https://www.postgresql.org/docs/current/queries-limit.html
- Laravel docs, "Cursor Pagination" and "Cursor vs. Offset Pagination": https://laravel.com/docs/12.x/pagination#cursor-pagination
- Prisma docs, "Pagination": https://www.prisma.io/docs/orm/prisma-client/queries/pagination
