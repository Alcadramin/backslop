# count-by-fetching

**Loading every matching row just to count them.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$n = Order::where('user_id', $id)->get()->count();
$n = count(Order::where('user_id', $id)->get());
$n = Order::all()->count();
```

```ts
const n = (await prisma.order.findMany({ where: { userId } })).length;
```

```python
n = len(Order.objects.filter(user_id=uid))
```

## Why it hurts

To get one number, the code fetches every matching row, sends it over the wire, builds a model for each one and counts the array. `SELECT COUNT(*)` returns one integer, and the database can often answer it from an index. The fetched version costs memory and transfer in proportion to the number of matches, so it gets slower as the table grows. With a few test rows nobody notices.

## Fix

```php
$n = Order::where('user_id', $id)->count();
$n = $user->orders()->count();                  // method call: COUNT(*) in SQL
$users = User::withCount('orders')->paginate(20); // per-parent counts: one query
```

```ts
const n = await prisma.order.count({ where: { userId } });
const users = await prisma.user.findMany({ include: { _count: { select: { orders: true } } }, take: 20 });
```

```python
n = Order.objects.filter(user_id=uid).count()
```

## When it's fine

- The rows are already loaded and shown on the same request. Counting the loaded collection costs nothing. Django's own docs say `len()` is fine when you evaluate the queryset anyway.
- The fetch is bounded (`->limit(20)->get()`, `take: 20`, a sliced queryset) and you need the rows too.

## How backslop detects it

A static rule. It reports:
- PHP: `->get()->count()`, `Model::all()->count()`, and `count(...->get())` / `count(Model::all())`.
- JS/TS: `(await x.findMany(...)).length` with no `take`/`limit`, and `const rows = await x.findMany(...)` with no `where`/`take`/`cursor`/`skip`, followed by `rows.length` in the same function.
- Python: `len(Model.objects...)` and `len(list(Model.objects...))` when the chain is only lazy calls (`filter`, `all`, `order_by`...) and not sliced.

It skips:
- fetches bounded by `limit`/`take`/`paginate`/`find` earlier in the chain,
- `collect([...])`, `Collection::` and facade calls such as `Config::all()` or `$request->all()`,
- test and migration files.

A comparison with zero (`->get()->count() > 0`) is reported as `exists-by-count-or-fetch` instead.

## Sources

- Django docs, "Use QuerySet.count()": https://docs.djangoproject.com/en/5.2/topics/db/optimization/#use-queryset-count
- Django QuerySet reference, `count()` (`len()` is fine when you load the objects anyway): https://docs.djangoproject.com/en/5.2/ref/models/querysets/#count
- Larastan rules docs, `NoUnnecessaryCollectionCall` (`User::all()->count()` is the documented example): https://github.com/larastan/larastan/blob/3.x/docs/rules.md
- Prisma Client reference, `count()` and relation `_count`: https://www.prisma.io/docs/orm/reference/prisma-client-reference#count
