# string-built-sql

**A value spliced into SQL text by concatenation or interpolation instead of a bind parameter.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
DB::select("SELECT * FROM users WHERE email = '$email'");
User::whereRaw("name LIKE '%" . $q . "%'")->get();
$pdo->query("SELECT * FROM orders WHERE user_id = {$id}");
```

```ts
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);
await knex.raw(`SELECT * FROM users WHERE id = ${id}`);
```

```python
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")
User.objects.raw("SELECT * FROM auth_user WHERE username = '%s'" % name)
```

## Why it hurts

Input that ends up in the SQL text can change the statement's structure: SQL injection. It is also a plain correctness bug, because a name with a quote in it breaks the query. And the database cannot reuse one plan across values. Bind parameters fix all three. Tests pass because test data has no quotes in it.

## Fix

```php
DB::select('SELECT id, name FROM users WHERE email = ?', [$email]);
User::where('name', 'like', '%'.$q.'%')->limit(20)->get();
$sort = in_array($request->sort, ['name', 'created_at'], true) ? $request->sort : 'created_at';
```

```ts
await prisma.$queryRaw`SELECT id, name FROM users WHERE email = ${email}`;   // tagged template: prepared
await knex.raw('SELECT id, name FROM users WHERE id = ?', [id]);
```

```python
cursor.execute("SELECT id FROM users WHERE email = %s", [email])
```

Identifiers (column names, sort direction) cannot be bound. Check them against an allowlist. Laravel's docs say PDO cannot bind column names, so never let user input choose one.

## When it's fine

- The spliced piece is a constant or an allowlisted identifier (`"ORDER BY {$col}"` after an `in_array` check).
- A table prefix from config.
- A placeholder list built from the number of values (`IN (?, ?, ?)`), with the values passed as bindings.

## How backslop detects it

A static rule. It looks at the first argument of raw-SQL entry points:
- PHP: `DB::select/statement/insert/update/delete/unprepared/raw`, `whereRaw`, `selectRaw`, `orderByRaw`, `havingRaw` and friends, and `$pdo->query/exec/prepare`.
- JS/TS: `$queryRawUnsafe`, `$executeRawUnsafe`, `knex.raw`, `sequelize.query`, `pool/db/client.query/execute`, `sql.raw`, `Prisma.raw`, knex `*Raw` methods.
- Python: `.execute(`, `.executemany(`, `.raw(`, `RawSQL(`, `text(`.

It rebuilds the SQL text with a marker where each value is spliced in (PHP `"$x"` and `.`, JS template `${}` and `+`, Python f-strings, `%` and `.format()`). It reports only when a marker sits in a value position: after `=`, `<`, `>`, `LIKE`, `IN (`, `VALUES (`, or inside `'...'`.

It does not report:
- identifiers (`FROM {$table}`), placeholder lists (`$placeholders`, `.map(() => '?')`), Postgres `$1` numbering,
- int casts (`(int) $id`, `intval`, `parseInt`), quoting helpers,
- variables that the same function assigns only from string literals,
- tagged `$queryRaw` templates, which are prepared.

Where installed, prefer the dedicated tools: Semgrep's `php.laravel.security.laravel-sql-injection` rule and Ruff `S608` / Bandit `B608` for Python. backslop keeps only these cheap checks.

## Sources

- Bill Karwin, *SQL Antipatterns*, "SQL Injection" chapter (chapter name from the publisher's table of contents).
- Laravel docs, Query Builder, "Raw Expressions" (parameter binding; PDO cannot bind column names; raw expressions are injected as strings): https://laravel.com/docs/12.x/queries#raw-expressions
- Prisma docs, "Raw queries" (`$queryRaw` vs `$queryRawUnsafe`): https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries
- Ruff `S608` hardcoded-sql-expression: https://docs.astral.sh/ruff/rules/hardcoded-sql-expression/
- Semgrep registry, `php.laravel.security.laravel-sql-injection.laravel-sql-injection`: https://registry.semgrep.dev/rule/php.laravel.security.laravel-sql-injection.laravel-sql-injection
