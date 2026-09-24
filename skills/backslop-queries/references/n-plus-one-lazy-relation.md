# n-plus-one-lazy-relation

**A lazy-loaded relation read inside a loop, often after an edit removed the eager load.**

Severity: high · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

`$book->author->name` looks like a property read. Without eager loading it runs a SELECT per book.

```php
// before
$books = Book::with('author:id,name')->latest()->paginate(25);
// after the agent's "cleanup"
$books = Book::latest()->paginate(25);
foreach ($books as $book) { echo $book->author->name; }   // 26 queries
```

```python
# select_related("blog") removed
for entry in Entry.objects.filter(published=True)[:50]:
    print(entry.blog.name)
```

```ts
// include: { author: true } removed, the code still reads p.author
const posts = await prisma.post.findMany({ take: 20 });
```

Prisma has no lazy relations, so `p.author` is just undefined there. TypeORM lazy relations behave like Eloquent ones.

## Why it hurts

It costs the same as an explicit query in a loop, but nothing in the code shows it. The Laravel docs' own example is 25 books producing 26 queries, and eager loading brings it to 2. It grows silently as pages get bigger or as someone reads one more relation in a template. Removing the guard that catches it (`preventLazyLoading`, `raiseload`) means the next N+1 passes the tests too.

## Fix

```php
$books = Book::with('author:id,name')->latest()->paginate(25);
// AppServiceProvider::boot
Model::preventLazyLoading(! $this->app->isProduction());
```

```python
Entry.objects.select_related("blog").prefetch_related("tags")[:50]
stmt = select(User).options(selectinload(User.addresses), raiseload("*")).limit(50)
```

```ts
prisma.post.findMany({ take: 20, include: { author: { select: { name: true } } } });
```

## When it's fine

- The relation is no longer read anywhere. Then removing the eager load is correct (see [overeager-loading](overeager-loading.md)).
- The query returns one model (`find`, `first`). One lazy load costs one query, not N.
- The relation is eager loaded elsewhere: the model's `$with`, a scope, or a `load()` later on.

## How backslop detects it

A diff rule. For each removed line it looks for:
- an eager load: `with(`, `load(`, `loadMissing(`, `withCount(`, `select_related(`, `prefetch_related(`, `selectinload(`, `joinedload(`, `subqueryload(`, Prisma `include:`. It reads the relation names from the quoted arguments, or from the keys of the removed `include: { ... }` block.
- a lazy-loading guard: `preventLazyLoading(`, `shouldBeStrict(`, `raiseload(`, `lazy="raise"`, `NPLUSONE_RAISE`.

An eager-load removal is reported only when all of these hold:
- no eager-load call is added back within 15 lines,
- a list query is still there (`get`, `paginate`, `all`, `findMany`, `.filter(`...), so single-row queries are skipped,
- the new file still reads one of the removed relations (`->author`, `.author`, `author__`).

A guard removal is reported unless the diff adds a guard back somewhere in the file.

## Sources

- Laravel docs, Eloquent Relationships, "Eager Loading" and "Preventing Lazy Loading": https://laravel.com/docs/12.x/eloquent-relationships#eager-loading
- Laravel docs, Eloquent, "Configuring Eloquent Strictness": https://laravel.com/docs/12.x/eloquent#configuring-eloquent-strictness
- SQLAlchemy 2.0, "Relationship Loading Techniques": https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html
- Django docs, `select_related()` and `prefetch_related()`: https://docs.djangoproject.com/en/5.2/topics/db/optimization/
