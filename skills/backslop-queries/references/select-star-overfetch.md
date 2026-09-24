# select-star-overfetch

**Fetching full rows or full models when the code needs one or two columns.**

Severity: low · Detected by: scanner (static, PHP only; TS and Python are review only) · Languages: PHP

## What it looks like

```php
// hydrate 10k full models to build an id => name map
$names = User::where('active', 1)->get()->pluck('name', 'id');
$ids   = Order::all()->pluck('id');
```

```ts
const users = await prisma.user.findMany({ take: 50 });   // also returns bio, settings JSON...
const emails = users.map((u) => u.email);
```

```python
emails = [u.email for u in User.objects.filter(is_active=True)]
```

## Why it hurts

Every column is sent over the wire and turned into an object. Wide columns (TEXT, JSON, BLOB) also inflate sort and hash memory. Worse, it blocks index-only scans: if an index covers the columns you need, one extra column forces a read of every table row. Winand's point is that the problem is fetching without deciding what you need. The `*` itself is just the symptom, and most ORMs select every column by default.

## Fix

```php
$names = User::where('active', 1)->pluck('name', 'id');     // SELECT name, id
$users = User::select(['id', 'name', 'email'])->paginate(50);
```

```ts
const users = await prisma.user.findMany({ take: 50, select: { id: true, name: true, email: true } });
```

```python
emails = list(User.objects.filter(is_active=True).values_list("email", flat=True))
```

## When it's fine

- You load full models because you will update and save them.
- The table is small or narrow.
- Do not `only()`/`defer()` everything by reflex. Django's docs warn that touching a deferred field costs another query.

## How backslop detects it

A static rule, PHP only. It reports `->get()->pluck(...)`, `->get()->modelKeys()` and the same after `Model::all()`: the collection call that could have been a query call. It skips chains already bounded by `limit`/`take`/`paginate`/`find`, in-memory collections (`collect()`), and test and migration files.

For TypeScript and Python this is review only. Look for `findMany` with no `select` on list endpoints over wide tables, `.map(u => u.x)` right after a fetch, and comprehensions that project one attribute from a queryset. Whether an endpoint needs the wide columns is a judgment call.

## Sources

- Markus Winand, "Don't ask for what you don't need" (Use The Index, Luke blog): https://use-the-index-luke.com/blog/2013-08/its-not-about-the-star-stupid
- Bill Karwin, *SQL Antipatterns* (Pragmatic Bookshelf), "Implicit Columns" chapter (chapter name from the publisher's table of contents): https://pragprog.com/titles/bksap1/sql-antipatterns-volume-1/
- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern": https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
- Django docs, "Use QuerySet.values() and values_list()" and "Use QuerySet.defer() and only()": https://docs.djangoproject.com/en/5.2/topics/db/optimization/
- Prisma docs, "Select fields": https://www.prisma.io/docs/orm/prisma-client/queries/select-fields
