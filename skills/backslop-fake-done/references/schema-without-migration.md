# schema-without-migration

**A model, entity or schema file changed and no migration was added, so it works against the test database and breaks in production.**

Severity: high · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
// app/Models/Order.php
protected $casts = ['shipped_at' => 'datetime'];   // new column, no file in database/migrations/
```

```python
# orders/models.py
email_verified = models.BooleanField(default=False)  # no new file in orders/migrations/
```

```prisma
// schema.prisma
model Order { shippedAt DateTime? }                 // no new folder in prisma/migrations/
```

## Why it hurts

Tests often build their database from the current models (SQLite in memory, `RefreshDatabase` with a schema dump, `prisma db push`), so they pass. Production has the old schema, and the first query that touches `shipped_at` fails. Django's docs put the contract plainly: "Migrations are Django's way of propagating changes you make to your models (adding a field, deleting a model, etc.) into your database schema." Prisma's docs note that `db push` "does not interact with or rely on migrations". No study read for this project measured how often agents skip the migration.

## Fix

Every schema change ships a migration: `php artisan make:migration`, `python manage.py makemigrations`, `prisma migrate dev`. Add a rollback where the framework supports it. Split destructive changes (drop, rename) into steps, and flag them in your reply. Don't edit a migration that has already been committed; add a new one.

## When it's fine

- Projects that generate migrations in CI, or prototypes that use `prisma db push` on purpose. Say so.
- Changes with no schema effect: an accessor, a cast of an existing column, a relation over existing keys.

## How backslop detects it

Review only. Spotting this needs the set of files in the change (a model changed and no migration added). The scanner judges one file at a time and doesn't read `.prisma` files. When reviewing, check:
- a diff touching `app/Models/*`, `models.py`, `schema.prisma`, `*.entity.ts` or a Drizzle schema has a matching new file under `database/migrations/`, `*/migrations/`, `prisma/migrations/` or `drizzle/`
- no already-committed migration was edited

## Sources

- Django docs, Migrations: https://docs.djangoproject.com/en/5.2/topics/migrations/
- Laravel docs, Database: Migrations ("Migrations are like version control for your database"): https://laravel.com/docs/12.x/migrations
- Prisma docs, Prototyping your schema (`db push`): https://www.prisma.io/docs/orm/prisma-migrate/workflows/prototyping-your-schema
