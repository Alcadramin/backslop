# nested-loop-join

**Matching two collections by scanning one for every item of the other: O(n·m) where indexing one side by key is O(n + m).**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

It's the literal reading of "for each user, find their orders", so agents write it this way.

```php
$users  = User::whereIn('id', $ids)->get()->toArray();
$orders = Order::whereIn('user_id', $ids)->get()->toArray();
foreach ($users as &$u) {
    $u['orders'] = array_values(array_filter($orders, fn ($o) => $o['user_id'] === $u['id']));
}

// Laravel collections hide the same scan
$posts->map(fn ($post) => $authors->first(fn ($a) => $a->id === $post->author_id));
```

```ts
const users = await prisma.user.findMany({ where: { id: { in: ids } } });
const orders = await prisma.order.findMany({ where: { userId: { in: ids } } });
return users.map((u) => ({ ...u, orders: orders.filter((o) => o.userId === u.id) }));
```

```python
for user in users:
    user.order_list = [o for o in orders if o.user_id == user.id]
```

## Why it hurts

Every outer item walks the entire inner collection. 2,000 users × 50,000 orders is 100 million comparisons, all to rebuild a grouping the code could compute in one pass. Databases avoid this with a hash join, and in-memory code can do the same with a map.

Agents often get here by fixing an N+1 query: "load both lists, then match in memory". That removes the queries but leaves a quadratic join. With seed data it looks instant.

## Fix

Index the inner side by the join key once, then look up:

```php
$byUser = [];
foreach ($orders as $o) {
    $byUser[$o['user_id']][] = $o;
}
foreach ($users as &$u) {
    $u['orders'] = $byUser[$u['id']] ?? [];
}

// one row per key: array_column does the index for you
$authorsById = array_column($authors, null, 'id');
```

In Laravel, `$orders->groupBy('user_id')` and `$authors->keyBy('id')` build the index. Eager loading (`with('orders')`) avoids the manual join entirely.

```ts
const byUser = Map.groupBy(orders, (o) => o.userId);   // ES2024; or build a Map in a loop
return users.map((u) => ({ ...u, orders: byUser.get(u.id) ?? [] }));
```

```python
from collections import defaultdict
by_user = defaultdict(list)
for o in orders:
    by_user[o.user_id].append(o)
for user in users:
    user.order_list = by_user[user.id]
```

## When it's fine

- The inner collection belongs to the outer item (`foreach ($user['addresses'] as $a)`). There's no cross product.
- Both sides are small and bounded by design, like five recipients on a document or ten columns in a schema.
- It's a real all-pairs computation, such as a distance matrix, which no index can replace.

## How backslop detects it

The scanner flags a search over another collection inside a loop when all of these hold:
- The search is a `.filter/.find/.findIndex/.some/.every` callback, `array_filter`, a Laravel `->filter/->first/->where/...` callback, or a nested `foreach`/`for...of`/`for...in`/comprehension.
- The search compares an inner item's field with the outer item using `==` or `===`, and at least one side is a field or index access.
- The inner collection is a plain variable. It doesn't depend on the outer item.
- That variable is loaded from a query or an awaited call in the same file: Eloquent `->get()/->all()/->toArray()/::all()`, `DB::select`, `fetchAll`, `= await ...`, Django `.objects.`, `.fetchall()`.

That last condition is deliberate. Small in-memory lists are joined this way all the time without harm, so the scanner only flags joins of two loaded result sets. Everything else is left to review. Tests, fixtures, seeders and migrations are skipped.

## Sources

- php-src `ext/standard/array.c` (array lookup by key is a hash lookup; `in_array`/`array_filter` scan): https://github.com/php/php-src/blob/master/ext/standard/array.c
- Python docs, "Time complexity of operations on built-in types" (dict access O(1) average): https://docs.python.org/3/builtins/time-complexity.html
- MDN, Set, "Performance": https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
- MDN, `Object.groupBy` (ES2024; `Map.groupBy` is its Map-returning pair): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy
