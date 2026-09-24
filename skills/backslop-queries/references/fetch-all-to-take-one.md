# fetch-all-to-take-one

**Loading many rows to keep the first, the last or a random one.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$latest = Order::where('user_id', $id)->get()->last();
$any    = Product::all()->random();
```

```ts
const latest = (await prisma.order.findMany({ where: { userId } }))[0];
const roles = await prisma.role.findMany();
const admin = roles.find((r) => r.name === 'admin');
```

```python
latest = list(Order.objects.filter(user_id=uid))[-1]
```

## Why it hurts

The whole result is transferred and hydrated, and all but one row is thrown away. `first()`, `findFirst` or a slice adds `LIMIT 1`, and with the right `ORDER BY` the database reads a single index entry. The cost of the bad version grows with the table. `::all()->random()` reads the entire table on every call.

## Fix

```php
$latest = Order::where('user_id', $id)->latest('id')->first();
```

```ts
const latest = await prisma.order.findFirst({ where: { userId }, orderBy: { id: 'desc' } });
const admin = await prisma.role.findFirst({ where: { name: 'admin' } });
```

```python
latest = Order.objects.filter(user_id=uid).order_by("-id").first()
```

Add an `ORDER BY` when you mean "latest" or "first". Without one, PostgreSQL's docs warn the row you get is unpredictable.

## When it's fine

- The collection is already loaded for the page and you reuse it.
- The pick needs PHP logic per row (`->first(fn ($i) => mb_strtolower($i->label) === $w)`) on a small, bounded set. backslop does not flag closures.

## How backslop detects it

A static rule. It reports:
- PHP: `->get()->first()`, `->get()->last()`, `->get()->firstWhere('col', ...)`, `->get()->random()` and the same after `Model::all()`.
- JS/TS: `(await x.findMany(...))[0]` and `.at(` / `.pop()` / `.shift()` / `.find(` on that result when there is no `take`, and `.find(` / `[0]` on a variable holding a whole-table `findMany()` (no `where`, `take`, `cursor` or `skip`).
- Python: `list(Model.objects...)[n]` on an unsliced lazy chain.

It skips closure arguments, chains already bounded by `limit`/`take`/`find`, in-memory collections, and test and migration files. `Model.objects.all()[0]` is not flagged: Django turns it into `LIMIT 1`.

## Sources

- Larastan rules docs, `NoUnnecessaryCollectionCall` (`first` is among the calls it flags): https://github.com/larastan/larastan/blob/3.x/docs/rules.md
- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern": https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
- PostgreSQL docs, "LIMIT and OFFSET": https://www.postgresql.org/docs/current/queries-limit.html
