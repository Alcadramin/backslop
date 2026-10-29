# boolean-flag-param

**A boolean argument that switches what a function does, often bolted onto an existing function for one new caller.**

Severity: low · Detected by: scanner (diff) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

A new requirement almost fits an existing function, so the agent adds `bool $x = false` and an `if`.

```php
-    public function build(array $rows, string $type): array
+    public function build(array $rows, string $type, bool $forAdmin = false): array
     {
         foreach ($rows as $row) {
+            if ($forAdmin) {
+                $row['cost'] = $row['internal_cost'];
+            }
```

```ts
-export async function sendEmail(user: User, template: string) {
+export async function sendEmail(user: User, template: string, skipUnsubscribed = false) {
+  if (skipUnsubscribed && user.unsubscribed) return;
```

```python
-def export_users(users):
+def export_users(users, legacy: bool = False):
     rows = [serialize(u) for u in users]
+    if legacy:
+        rows = [downgrade(r) for r in rows]
```

## Why it hurts

At the call site `build($rows, 'sales', true)` doesn't say what `true` means. Inside, the function is now two functions sharing a signature, and every later change has to keep both paths working. It is also the first step of [wrong-abstraction](wrong-abstraction.md): the next caller adds another flag, and after a few rounds no caller uses the whole function.

## Fix

Write the variation as its own, named function, and keep what is truly shared in a small helper both call.

```php
public function build(array $rows, string $type): array { /* unchanged */ }
public function buildForAdmin(array $rows, string $type): array
{
    return $this->build(array_map(fn ($r) => [...$r, 'cost' => $r['internal_cost']], $rows), $type);
}
```

Or let the one caller that needs the variation do it before or after the call.

## When it's fine

- The value comes straight from data, such as a checkbox or a stored setting (`setActive($row['active'])`).
- A private helper behind explicit public methods.
- A flag that tunes a detail without switching behaviour (`$touch` timestamps). Named arguments (`render($data, escape: true)`) fix the call-site readability for these.
- Framework-imposed signatures.

## How backslop detects it

Diff mode only. The scanner reports a finding when:
- a function's declaration line was removed and re-added with the same name,
- the new version has a boolean parameter the old one didn't: `bool $x`, `$x = false`, `x: boolean`, `x = true`, `x: bool = False`,
- an added line inside that function branches on it: `if`, a ternary, `&&`/`||`, `and`/`or`/`not`.

It isn't flagged when:
- the function is brand new,
- the flag existed before,
- the new parameter isn't boolean,
- the flag is only assigned or passed on.

Signatures split over several lines aren't seen.

## Sources

- Fowler, bliki "FlagArgument": https://martinfowler.com/bliki/FlagArgument.html; *Remove Flag Argument*: https://refactoring.com/catalog/removeFlagArgument.html
- Metz, "The Wrong Abstraction": https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
