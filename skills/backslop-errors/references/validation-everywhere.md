# validation-everywhere

**The same validation repeated in the controller, the service, the repository and the model.**

Severity: low (medium when the copies disagree) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
// controller
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { throw new InvalidEmail($email); }
// service, a second, different rule
if (!preg_match('/^[^@]+@[^@]+$/', $email)) { return false; }
```

```ts
const body = CreateUser.parse(req.body);          // zod at the route
// ...then in the service
if (!body.email.includes('@')) throw new Error('bad email');
```

## Why it hurts

Four copies are four places to update, and they drift. One accepts `+` in an address and another doesn't, so whether a request works depends on which entry point it came through. The extra checks also tend to fail quietly (`return false`), which hides the case the boundary should have rejected.

## Fix

Validate once at the trust boundary, then pass a type that can only hold valid data:

```php
final class Email
{
    public function __construct(public readonly string $value)
    {
        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidEmail($value);
        }
    }
}
// services accept Email, not string
```

In TS, have the service take the parsed type (`z.infer<typeof CreateUser>`) instead of re-checking fields.

## When it's fine

- Security checks at every entry point: authorization, parameterized SQL everywhere. Keep those.
- Database constraints (`NOT NULL`, `UNIQUE`, foreign keys) are a separate, legitimate layer.

## How backslop detects it

Review only. Look for the same validation call or regex (`filter_var(..., FILTER_VALIDATE_*)`, an email regex, `<= 0` checks, Laravel rule strings like `'required|email'`) in three or more files, and for two different rules applied to the same field name.

## Sources

- Steve McConnell, *Code Complete* (2nd ed.), ch. 8, §8.5 "Barricade Your Program to Contain the Damage Caused by Errors".
- Hunt & Thomas, *The Pragmatic Programmer* (20th anniversary ed.), Topic 9 "DRY" and Topic 23 "Design by Contract".
- Martin Fowler, "Replace Primitive with Object": https://refactoring.com/catalog/replacePrimitiveWithObject.html
