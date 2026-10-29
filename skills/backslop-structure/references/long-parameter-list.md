# long-parameter-list

**Functions with six or more positional parameters, and the same group of parameters passed through many signatures.**

Severity: low · Detected by: review only (ESLint `max-params`, Ruff `PLR0913`, PHPMD `ExcessiveParameterList` count them) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
function ship(string $name, string $street, string $city, string $zip, string $country, float $weight, bool $express) { /* ... */ }
```

```python
def quote(lat1, lon1, lat2, lon2, units): ...
```

## Why it hurts

Callers pass arguments in the wrong order and nothing complains when they share a type: `$city` and `$zip` are both strings. When `$street, $city, $zip` travel together through five signatures (a data clump), adding a field means editing all five. Fowler calls that Shotgun Surgery.

## Fix

Name the concept once, as a parameter object or value object.

```php
function ship(Address $to, Parcel $parcel, ShippingSpeed $speed) { /* ... */ }
```

```python
def quote(origin: Point, dest: Point, units: Units): ...
```

If the function needs the whole object, pass it (Fowler's *Preserve Whole Object*) instead of unpacking five fields at every call site.

## When it's fine

- DTO and value-object constructors with PHP 8 constructor promotion or dataclasses: many fields is the point.
- Dependency-injection constructors, up to the point where the class is doing too much (see [deep-inheritance-or-god-class](deep-inheritance-or-god-class.md)).
- Keyword-only parameters in Python (`def f(*, a, b, c)`) and named arguments in PHP 8, which remove the ordering risk.

## How backslop detects it

Review only. When you add a parameter, count them. At six or more, or when you see the same three names in several signatures, introduce an object.

## Sources

- Fowler, *Refactoring* 2nd ed., ch. 3 (Long Parameter List, Data Clumps, Shotgun Surgery); *Introduce Parameter Object*: https://refactoring.com/catalog/introduceParameterObject.html; *Preserve Whole Object*: https://refactoring.com/catalog/preserveWholeObject.html; *Replace Primitive with Object*: https://refactoring.com/catalog/replacePrimitiveWithObject.html
