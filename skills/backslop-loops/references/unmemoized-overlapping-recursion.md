# unmemoized-overlapping-recursion

**Recursion that computes the same subproblem again and again, and in backend code usually queries the database for it each time.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
// the full path of a category, computed for every category in a list
function path(int $id): string
{
    $c = Category::find($id);                                // a query per level, per call
    return $c->parent_id ? path($c->parent_id) . '/' . $c->slug : $c->slug;
}

foreach ($categories as $c) {
    $paths[$c->id] = path($c->id);                           // siblings re-walk the same parents
}
```

Inheriting permissions up a role tree and fib-style counting have the same shape.

## Why it hurts

Every node in a list walks its ancestors again, even though its siblings already walked the same ones. For a tree of n nodes and depth d, that's n·d lookups instead of n. When subproblems branch (two recursive calls per level), the cost grows exponentially. Each level here is also a query, so it's an N+1 as well: see [n-plus-one-query-in-loop](../../backslop-queries/references/n-plus-one-query-in-loop.md).

## Fix

Load the tree once, index it by id, and memoize:

```php
$byId = array_column(Category::all()->toArray(), null, 'id');   // one query
$memo = [];
$path = function (int $id) use (&$path, &$memo, $byId): string {
    if (isset($memo[$id])) {
        return $memo[$id];
    }
    $node = $byId[$id];
    return $memo[$id] = $node['parent_id'] ? $path($node['parent_id']) . '/' . $node['slug'] : $node['slug'];
};
```

```python
import functools

@functools.cache
def path(category_id): ...
```

## When it's fine

- Traversals that visit each node once (no overlapping subproblems) don't need memoization.
- Shallow, small trees by design.

## How backslop detects it

Review only. Whether calls overlap depends on the data shape. In review, ask of each recursive function you wrote:
- Can two calls reach the same argument?
- Does each level hit the database or the network?

If either answer is yes, load the data once and memoize.

## Sources

- Python docs, `functools.cache` / `lru_cache`: https://docs.python.org/3/library/functools.html
