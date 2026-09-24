# load-relation-for-fk

**Loading a related model just to read an id the row already holds.**

Severity: low (medium inside a loop) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$ids = $orders->map(fn ($o) => $o->customer->id);        // one query per order
if ($post->author->id === auth()->id()) { /* ... */ }
```

```ts
const p = await prisma.post.findUnique({ where: { id }, include: { author: true } });
use(p.author.id);
```

```python
if entry.blog.id == blog_id:
    ...
```

## Why it hurts

`$order->customer->id` runs a query (or forces an eager load) to read a value the order row already has in `customer_id`. Once is a wasted round trip. Inside a loop it is an N+1 for nothing (see [n-plus-one-lazy-relation](n-plus-one-lazy-relation.md)).

## Fix

Read the foreign key column.

```php
$ids = $orders->pluck('customer_id');
if ($post->author_id === auth()->id()) { /* ... */ }
```

```ts
const p = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
use(p.authorId);
```

```python
if entry.blog_id == blog_id:
    ...
```

## When it's fine

- The relation is already loaded for other fields, so reading its id costs nothing.
- Accessors such as `auth()->user()->id` or `$request->user()->id`. Those are method calls on the current user, not a relation lookup.
- Polymorphic or custom-key relations, where the foreign key column is not `<relation>_id`.

## How backslop detects it

Review only. Telling a relation from a column needs the model definitions. Look for:

- PHP `$x->relation->id` (a property chain, not `->relation()->`). Suggest `$x->relation_id`.
- Python `x.relation.id` / `x.relation.pk`, excluding `request.user.id`.
- Prisma `include: { x: true }` where the code only reads `.x.id`.
- A diff that replaces `->x_id` / `.x_id` / `xId` with `->x->id` / `.x.id`.

## Sources

- Django docs, "Use foreign key values directly": https://docs.djangoproject.com/en/5.2/topics/db/optimization/#use-foreign-key-values-directly
