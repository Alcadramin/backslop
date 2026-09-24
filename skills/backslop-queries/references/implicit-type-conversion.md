# implicit-type-conversion

**Comparing a column to a value of a different type, so the database converts the column and skips its index.**

Severity: medium · Detected by: review only · Languages: PHP, Python

## What it looks like

```php
// legacy_id is VARCHAR, the value is an int
Customer::where('legacy_id', (int) $id)->first();
```

```python
cursor.execute("SELECT id FROM customers WHERE legacy_id = %s", [int(x)])
```

```sql
SELECT id FROM contacts WHERE phone = 5551234;   -- phone is VARCHAR
```

## Why it hurts

When a string column is compared to a number, many databases convert every value in the column to a number before comparing. That defeats the index on the column, so the lookup reads the whole table. It can also fail at runtime when one row holds a value that doesn't parse as a number. PostgreSQL rejects the query instead of converting. In ORM code it sneaks in when an id stored as a string is bound as an int, or when a join compares columns with different types or collations.

## Fix

Bind the value with the column's type.

```php
Customer::where('legacy_id', (string) $id)->first();
```

```python
cursor.execute("SELECT id FROM customers WHERE legacy_id = %s", [str(x)])
```

If the values are numbers, store them as numbers.

## When it's fine

- The types already match. Without the schema, most casts in queries are fine.
- PostgreSQL, which raises an error rather than silently converting.

## How backslop detects it

Review only. It needs the column types from the schema, and a regex without them flags too many honest casts. Look for:

- `(int)`, `intval(`, `parseInt(`, `Number(` or `int(` on a value compared to a column named like a code (`*_code`, `*_ref`, `sku`, `phone`, `zip`, `legacy_id`, `external_id`).
- SQL strings comparing such a column to an unquoted number.
- Migrations: a `string`/`char`/`uuid` column compared in code to an integer.

## Sources

- Use The Index, Luke, "Obfuscated Conditions", "Numeric Strings": https://use-the-index-luke.com/sql/where-clause/obfuscation/numeric-strings
