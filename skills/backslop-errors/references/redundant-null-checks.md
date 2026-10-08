# redundant-null-checks

**Defensive checks on values whose type already says they can't be null.**

Severity: low · Detected by: scanner (PHP typed parameters) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
public function send(User $user, array $items): void
{
    if ($user === null) { return; }                       // can't happen
    if (!is_array($items) || empty($items) || count($items) === 0) { return; }
    $name = $user?->name ?? '';
    ...
}
```

```ts
function greet(user: User) {
  if (!user) return '';
  return `Hi ${user?.name ?? ''}`;
}
```

## Why it hurts

The checks are noise, and they tell the reader the contract is unclear. Worse, they usually come with a silent `return`. If the "impossible" case ever happens because of a real bug upstream, the function quietly does nothing instead of failing where the bug is. That is the same hiding as [empty-catch](empty-catch.md), just without a try.

In PHP, a user-defined function with a non-nullable parameter type throws `TypeError` when passed `null`, even in coercive (non-strict) mode. A `$user === null` check inside it can never be true.

## Fix

Trust the type. Validate once at the boundary (the request, the DTO, the deserializer), then pass the typed value inward. McConnell calls this a barricade. If null really is allowed, say so in the type: `?User $user = null`, `user: User | null`.

```php
public function send(User $user, array $items): void
{
    if ($items === []) { return; }          // a real case, and the only check left
    ...
}
```

## When it's fine

- Public entry points called from untyped code: JS callers of a TS API, PHP code that reads `json_decode` output, ORM hydration whose declared type is optimistic.
- TS `strictNullChecks` off, or Python type hints, which nothing enforces at runtime.

## How backslop detects it

PHP only, where the language enforces the type. For each function parameter with a declared type that is not nullable (no `?`, no `|null`, not `mixed`, no `= null` default), it flags in the same function:
- `$x === null` and `$x !== null`;
- `is_null($x)` and `isset($x)`;
- `$x ?? ...` and `$x?->`.

Skipped: parameters that are reassigned, passed by reference or `unset`, and code in nested closures. Use PHPStan, Psalm or `typescript-eslint/no-unnecessary-condition` for the full, type-aware version.

## Sources

- Steve McConnell, *Code Complete* (2nd ed.), ch. 8, §8.5 "Barricade Your Program to Contain the Damage Caused by Errors".
- PHP RFC "Deprecate passing null to non-nullable arguments of internal functions" (user-defined functions "already generate a TypeError for null arguments"): https://wiki.php.net/rfc/deprecate_null_to_scalar_internal_arg
- PHPStan `IssetRule`; Psalm `RedundantCondition`, `TypeDoesNotContainNull`; typescript-eslint `no-unnecessary-condition`.
