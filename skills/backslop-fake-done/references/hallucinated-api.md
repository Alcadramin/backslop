# hallucinated-api

**A call to a method, option or config key that doesn't exist in the installed version of the library or framework.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$users = User::whereLike('name', $q)->paginateFast(50);   // no such method
$timeout = config('queue.retry_after_seconds');           // nothing defines this key; returns null
```

```ts
await prisma.user.findMany({ distinctOn: ['email'] });    // not an option in the installed version
```

```python
resp = httpx.get(url, retries=3)   # not a parameter of httpx.get
```

## Why it hurts

The name sounds right, so it passes review by eye. In PHP and Python it fails only at runtime, on the path that calls it. Often that's the untested error or edge path, so it fails in production. Config keys are worse: `config('x.y')` that nothing defines returns `null`, and the code quietly runs with no timeout or a default of zero.

## Fix

Check the installed version before you call something: its docs for that version, or its source in `vendor/`, `node_modules/` or `site-packages/`. Run the project's own type checker or static analysis (`tsc --noEmit`, `phpstan`, `mypy`) and fix what it reports. Don't suppress it (see [checker-suppressed](checker-suppressed.md)).

## When it's fine

Macros, magic methods (`__call`, Laravel local scopes like `scopeActive` called as `active()`), dynamic proxies and plugins that add methods at runtime. These look invented and aren't. Find where they're defined.

## How backslop detects it

Review only. Knowing what exists in the installed version needs the dependency source or a type checker, and the scanner has neither. When reviewing, for every method, option or config key that's new to this codebase, find its definition, and run the type checker or static analysis in the session.

## Sources

- Spracklen et al. (USENIX Security 2025), for the same failure at the package level: https://arxiv.org/abs/2406.10279
