# missing-index-for-new-predicate

**A new WHERE, JOIN or ORDER BY column with no index behind it.**

Severity: medium (high for a new lookup by external id or token on a large table) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The agent adds a column in a migration and a query that filters on it, and no index.

```php
// migration
$table->string('external_ref')->nullable();

// code
Order::where('external_ref', $ref)->first();
```

```prisma
model Order {
  id          Int     @id @default(autoincrement())
  externalRef String?
  customerId  Int
  customer    Customer @relation(fields: [customerId], references: [id])
}
```

```python
class Order(models.Model):
    external_ref = models.CharField(max_length=64, null=True)
```

## Why it hurts

Every lookup on that column reads the whole table (a Seq Scan in PostgreSQL), and every sort on it is a full sort instead of reading an index in order. It is fast in development and gets slower as the table grows.

Foreign keys behave differently per database. PostgreSQL does not create an index on the referencing column, so a parent `DELETE` or `UPDATE` also scans the child table. MySQL InnoDB creates one automatically, and Django creates one for `ForeignKey` by default. Adding the index later on a big PostgreSQL table without `CONCURRENTLY` blocks writes while it builds.

## Fix

Add the index in the same change, and check the plan on realistic data.

```php
$table->string('external_ref')->nullable()->index();      // or ->unique()
$table->foreignId('customer_id')->constrained()->index();  // explicit, for PostgreSQL
```

```prisma
  @@index([externalRef])
  @@index([customerId])
```

```python
class Meta:
    indexes = [models.Index(fields=["external_ref"])]
```

Run `EXPLAIN` on the query. `EXPLAIN ANALYZE` executes the statement, so wrap writes in `BEGIN` / `ROLLBACK`.

## When it's fine

- Low-cardinality columns (booleans, small enums), where the planner would not use the index.
- Tiny tables.
- The column is already the leading column of a composite index.
- Write-heavy tables where someone judged the index not worth its cost. Index deliberately, not everything.

## How backslop detects it

Review only. It needs the schema, the existing indexes and the data volume. Look for:

- Columns added in this diff's migrations (`$table->string('x')`, Prisma fields, `models.XField(`) that also appear in new `where(`, `orderBy(`, `filter(x=`, `order_by("x")`, or `where: { x:` lines.
- Each such column: is there an `->index()`, `->unique()`, `@@index`, `@unique`, `db_index=True`, `Meta.indexes` or `CREATE INDEX`?
- PostgreSQL projects: `foreignId(...)->constrained()` without an index.

## Sources

- PostgreSQL docs, "Constraints", Foreign Keys (no automatic index on referencing columns): https://www.postgresql.org/docs/current/ddl-constraints.html
- MySQL 8.4 docs, "FOREIGN KEY Constraints", "Conditions and Restrictions": https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html
- Django docs, model field reference, `ForeignKey`: https://docs.djangoproject.com/en/5.2/ref/models/fields/
- Django docs, "Use standard DB optimization techniques": https://docs.djangoproject.com/en/5.2/topics/db/optimization/
- PostgreSQL docs, "Using EXPLAIN": https://www.postgresql.org/docs/current/using-explain.html
- PostgreSQL docs, `CREATE INDEX`, `CONCURRENTLY`: https://www.postgresql.org/docs/current/sql-createindex.html
- Bill Karwin, *SQL Antipatterns*, "Index Shotgun" chapter (chapter name from the publisher's table of contents).
