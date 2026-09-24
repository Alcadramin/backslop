# overeager-loading

**Eager loading relations nobody uses, or every relation on every query.**

Severity: low · Detected by: review only · Languages: PHP, TypeScript/JavaScript

## What it looks like

The overcorrection of an N+1 fix. Told to "fix N+1", the agent loads everything, everywhere.

```php
// model-wide: every query on Post pays for five extra loads
protected $with = ['author', 'comments', 'tags', 'media', 'category'];
```

```ts
// the list only shows titles and author names
prisma.post.findMany({ take: 20, include: { author: true, comments: true, tags: true, likes: true } });
```

## Why it hurts

Each eager load is another query, or a join that multiplies rows. It runs whether the page uses the data or not. Loading a to-many relation (`comments`) just to count it pulls every child row into memory. A model-wide `$with` puts that cost on every query of the model, including background jobs that never touch the relations. Azure notes that extraneous fetching often comes from overcompensating for chatty I/O.

## Fix

Load per query, only what this endpoint renders, and count instead of loading when you only need a number.

```php
Post::with('author:id,name')->withCount('comments')->paginate(20);
```

```ts
prisma.post.findMany({
  take: 20,
  select: { id: true, title: true, author: { select: { name: true } }, _count: { select: { comments: true } } },
});
```

## When it's fine

- The endpoint really renders all of those relations.
- A small relation that nearly every use of the model needs (one belongs-to on a model that is always shown with it).

## How backslop detects it

Review only. Whether a relation is used depends on the view, the resource and the caller. Look for:

- `protected $with = [` with three or more relations on a model.
- `include: { x: true }` on a to-many relation where the code later only reads `.x.length`. Use `_count` / `withCount` instead.
- A diff that adds several relations to `with(` / `include:` / `prefetch_related(` at once. Ask which ones the page reads.
- `nplusone` reports unused eager loads for Django and Flask-SQLAlchemy at runtime.

## Sources

- Microsoft Azure Architecture Center, "Extraneous Fetching antipattern" (overcompensating for chatty I/O): https://learn.microsoft.com/azure/architecture/antipatterns/extraneous-fetching/
- `nplusone` (also reports unnecessary eager loads): https://github.com/jmcarp/nplusone
