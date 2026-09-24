# row-by-row-writes

**One INSERT, UPDATE or DELETE per row inside a loop, where one statement would do.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
foreach ($rows as $r) {
    Price::updateOrCreate(['sku' => $r['sku']], ['amount' => $r['amount']]);  // 2 queries per row
}
foreach (Order::where('status', 'stale')->get() as $o) { $o->delete(); }
```

```ts
for (const r of rows) await prisma.price.create({ data: r });
```

```python
for r in rows:
    Price.objects.create(**r)
for o in Order.objects.filter(status="stale"):
    o.archived = True
    o.save()
```

## Why it hurts

10,000 `save()` calls are 10,000 round trips and 10,000 statement parses, often with 10,000 implicit transactions and a log flush each. One multi-row INSERT, `UPDATE ... WHERE`, `DELETE ... WHERE` or upsert does the same work in one or a few statements. The loop also holds locks for longer overall, and loading models just to change a field reads every row first. An import of 20 test rows is instant, so nobody sees it until the real file arrives.

## Fix

```php
Price::upsert($rows, uniqueBy: ['sku'], update: ['amount']);   // chunk $rows to ~500-1000 per call
Order::where('status', 'stale')->delete();
DB::table('prices')->insert($rows);
```

```ts
await prisma.price.createMany({ data: rows, skipDuplicates: true });
await prisma.order.updateMany({ where: { status: 'stale' }, data: { archived: true } });
```

```python
Price.objects.bulk_create([Price(**r) for r in rows], batch_size=1000)
Order.objects.filter(status="stale").update(archived=True)
```

Laravel's `upsert` needs a primary or unique index on the `uniqueBy` columns. Bulk methods skip model events: Django's docs say `bulk_create` does not call `save()` or send signals, and `update()` skips them too.

## When it's fine

- The write must fire model events, observers, signals or audit hooks. Ask "do I need events here?" before switching to bulk, and say which way you chose.
- Each row gets its own computed value (reordering positions) and the set is small.
- The loop is small and bounded, or it is a queue worker that handles one record per job.

This is why the rule is low severity: many per-row writes are deliberate.

## How backslop detects it

A static rule. It finds writes whose innermost scope runs per item (loops, collection callbacks, `.map` callbacks):
- PHP: `->save()`, `->delete()`, `->forceDelete()`, `->touch()`, `->update([...])`, `->increment('col')`, `Model::create/insert/updateOrCreate/firstOrCreate/upsert/destroy(...)` when the class is imported from a `Models` namespace, `DB::insert/update/delete/statement`, `DB::table(...)->insert(...)`, relation writes such as `->tags()->attach()`, and PDO `INSERT/UPDATE/DELETE`.
- JS/TS: Prisma `create/update/upsert/delete` (not `*Many`), awaited `save/insert/update/delete/remove` on a repository, model class or the loop variable, knex `db('t').insert/update/del`, and raw `INSERT/UPDATE/DELETE` via `pool.query`.
- Python: `obj.save()` (keyword arguments only, not `commit=False`), `obj.delete()`, `Model.objects.create/get_or_create/update_or_create`, `.objects....update(`, `session.commit()` in the loop, and `cursor.execute("INSERT ...")`.

It does not report:
- `while`/`do` loops, loops over chunks or batches, and per-row jobs over `lazyById()`/`cursor()`/`chunk()` streams,
- loops that bind a position index (`int $index`, `$index =>`, `enumerate(`), which usually reorder rows,
- bulk calls (`insert($chunk)`, `bulk_create`) inside batch loops,
- loops over a literal list or a single-digit count,
- tests, migrations, seeders and factories.

## Sources

- Django docs, "Use bulk methods": https://docs.djangoproject.com/en/5.2/topics/db/optimization/#use-bulk-methods
- Django QuerySet reference, `bulk_create`: https://docs.djangoproject.com/en/5.2/ref/models/querysets/#bulk-create
- Prisma docs, "Query optimization", "Bulk queries": https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance
- Laravel docs, Eloquent, "Upserts": https://laravel.com/docs/12.x/eloquent#upserts
- Doctrine ORM docs, "Batch Processing": https://www.doctrine-project.org/projects/doctrine-orm/en/3.6/reference/batch-processing.html
