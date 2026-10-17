# check-then-insert-race

**Uniqueness or another invariant checked in app code, then written, with no database constraint behind it.**

Severity: high · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
if (! Subscription::where('user_id', $uid)->where('plan', $plan)->exists()) {
    Subscription::create(['user_id' => $uid, 'plan' => $plan]);
}
```

```ts
if (!(await prisma.user.findUnique({ where: { email } }))) await prisma.user.create({ data: { email } });
```

```python
if not Coupon.objects.filter(user=user, code=code).exists():
    Coupon.objects.create(user=user, code=code)
```

## Why it hurts

Two concurrent requests both pass the check and both insert. Double-clicks, client retries and webhook redelivery all produce exactly this concurrency. Kleppmann describes it as a phantom / write-skew problem: a row lock can't protect a row that doesn't exist yet, so `lockForUpdate` on the check doesn't help. The reliable fixes are a unique constraint (and handling the violation) or serializable isolation with retries. Prisma's docs also point to unique constraints as what makes repeated upserts touch only one row.

## Fix

```php
// migration
$table->unique(['user_id', 'plan']);
// code: atomic upsert, still prepared for the violation under a race
try {
    Subscription::firstOrCreate(['user_id' => $uid, 'plan' => $plan]);
} catch (UniqueConstraintViolationException) {
    // someone else created it: fine
}
```

```ts
// schema: email String @unique
await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
```

## When it's fine

- A unique index already exists and the code handles the violation.
- A single writer by design.

Laravel's `firstOrCreate` is itself check-then-insert, so it still needs the unique index.

## How backslop detects it

Review only. The check is only safe if a unique index exists in the schema or migrations, and a regex on one file can't see that. Look for:
- `exists()`, `findFirst`, `findUnique` or `count() === 0` in an `if (!...)`, followed within a few lines by `create(` / `insert(` on the same model
- a migration diff that removes `->unique(`, `@unique` or `UNIQUE`

## Sources

- Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 7 "Transactions", "Write Skew and Phantoms" (section names confirmed through secondary notes, not the book text).
- PostgreSQL docs, Transaction Isolation (Serializable needs retries on 40001): https://www.postgresql.org/docs/current/transaction-iso.html
- Prisma docs, Transactions (idempotent upserts via unique constraints): https://www.prisma.io/docs/orm/prisma-client/queries/transactions
