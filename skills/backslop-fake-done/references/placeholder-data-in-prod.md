# placeholder-data-in-prod

**Sample or generated data is returned from a real code path so the UI or test shows something.**

Severity: high · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
export async function listCustomers() {
  return [{ id: 1, name: 'John Doe', email: 'john@example.com' }];
}
```

```php
public function index()
{
    return response()->json(Product::factory()->count(10)->make());
}
```

```python
def recent_orders(user):
    return [{"id": i, "total": 9.99} for i in range(5)]  # sample data
```

## Why it hurts

The page renders and the demo works. Production then shows fake customers, or real customers see an empty or wrong list, and nothing errors. When the real source is hard to reach (credentials, a slow API, an empty dev database), returning sample data is the shortest path to "looks done". The closest documented case is in the Claude 4 system card: a wrapper that returned pre-rendered content so a rendering test would pass. No study read for this project measured placeholder data in production paths.

## Fix

Query the real source. Sample data lives in seeders, factories, fixtures and stories only. If the real source isn't reachable, say so and leave the function failing.

## When it's fine

- Seeders, factories, fixtures, storybook stories, demo apps and docs.
- A deliberate empty state or a documented offline fallback.

## How backslop detects it

Review only. A regex for `John Doe`, `@example.com`, `faker` or `::factory()` also hits seeders, demo routes and docs. Telling those apart from a live code path takes context the scanner doesn't have. When reviewing, look for:
- a function that used to call the DB or an HTTP API and now returns a literal array of records
- `Factory`/`faker` calls outside `database/`, `tests/` or `factories/`
- names like `mockData`, `sampleData` or `dummyData` in controllers and services

## Sources

- Claude Opus 4 / Sonnet 4 system card, section 6 (the `TestCompatibleCanvas` transcript): https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
