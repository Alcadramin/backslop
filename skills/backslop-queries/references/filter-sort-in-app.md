# filter-sort-in-app

**Fetching rows and then filtering or sorting them in app code, where no index helps.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The second half of the classic "optimization": the agent drops the query's `where` and `orderBy`, loads the table, and does the work in memory.

```php
$active = User::all()->where('active', true)->sortByDesc('created_at')->take(20);
$recent = Order::where('paid', true)->get()->sortByDesc('created_at');
```

```ts
const users = (await prisma.user.findMany()).filter((u) => u.active);
const posts = await prisma.post.findMany();
posts.sort((a, b) => +b.createdAt - +a.createdAt);
```

```python
users = [u for u in User.objects.all() if u.is_active]
ranked = sorted(User.objects.filter(is_staff=True), key=lambda u: u.date_joined)
```

## Why it hurts

The database has indexes and a planner built to find matching rows. A `WHERE` on an indexed column touches a few pages. The app-side version reads every row, sends it over the network, builds an object for each and throws most of them away. Cost follows the table size, not the result size, and it is paid on every request. Tests pass because the test table is tiny.

## Fix

```php
$active = User::where('active', true)->latest()->limit(20)->get();
```

```ts
const users = await prisma.user.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 20 });
```

```python
users = User.objects.filter(is_active=True).order_by("-date_joined")[:20]
```

If the goal was fewer queries, use eager loading (see [n-plus-one-lazy-relation](n-plus-one-lazy-relation.md)). Do not trade a bounded SQL filter for an unbounded fetch.

## When it's fine

- The set is already small and bounded: one user's addresses, a page of 20.
- The condition needs logic SQL cannot express: a permission policy, a computed accessor. That is fine on a bounded set. On an unbounded one, narrow it in SQL first.
- The collection never came from the database (`collect([...])`).

## How backslop detects it

A static rule. It reports:
- PHP: `Model::all()` or `->get()` followed directly by `->where('col', ...)`, `whereIn`, `whereNull`, `sortBy('col')`, `sortByDesc`, `sort()`, `take`, `slice`, `skip`, `search` and similar collection calls.
- JS/TS: `(await x.findMany(...)).filter(` / `.sort(` / `.slice(` / `.every(` with no `take`, and the same calls on a variable that holds a `findMany()` with no `where`, `take`, `cursor` or `skip`.
- Python: a comprehension with `if` over `Model.objects...`, and `sorted(Model.objects...)`, on an unsliced lazy chain.

It skips:
- PHP calls whose argument is a closure or callable (`->filter(fn ...)`, `->sortBy([fn ...])`). Those usually hold logic SQL cannot express.
- chains already bounded by `limit`/`take`/`paginate`/`find`,
- `collect()`, `Collection::`, facades such as `Config::all()`,
- test and migration files.

## Sources

- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern": https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
- Django docs, "Do database work in the database rather than in Python": https://docs.djangoproject.com/en/5.2/topics/db/optimization/#do-database-work-in-the-database-rather-than-in-python
- Larastan rules docs, `NoUnnecessaryCollectionCall`: https://github.com/larastan/larastan/blob/3.x/docs/rules.md
