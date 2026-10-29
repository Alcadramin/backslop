# needless-type-roundtrip

**Serialising to JSON and parsing it straight back, in memory, to convert or copy a value.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
$data = json_decode(json_encode($order), true);   // "convert to array"
```

```ts
const copy = JSON.parse(JSON.stringify(order));   // "deep clone"
```

```python
data = json.loads(json.dumps(order.__dict__))
```

Related shapes worth catching in review: `(object)(array)$x`, `Dto::fromArray($dto->toArray())` inside one layer, `Carbon::parse($date->format(...))`, `new Date(d.toISOString())`.

## Why it hurts

The value is serialised and parsed for nothing, and the trip loses data without an error:
- PHP drops private and protected properties, and an empty array that should be `{}` comes back as `[]`. `json_decode` returns `null` on failure, so a bad value becomes `null` instead of an error.
- JavaScript turns `Date` into a string, drops `undefined` and functions, and throws on `BigInt` and cycles.
- Python's `json.dumps` raises on `datetime`, `Decimal` and sets.

The cost also grows with the size of the value.

## Fix

Keep the value in the form you already have, or use the conversion that exists for it:

```php
$data = $order->toArray();            // Eloquent, or a DTO's own method; get_object_vars() for one level
```

```ts
const copy = structuredClone(order);  // keeps Date, Map, Set; Node 17+, all current browsers
const sorted = [...fields].sort(byY); // or no copy at all if you only needed a new array
```

```python
data = dataclasses.asdict(order)      # or copy.deepcopy(order)
```

## When it's fine

- Normalising at a boundary on purpose, such as before caching, queueing or storing JSON, so the value equals what will be read back. Use a custom encoder or replacer, or say why in a comment. The scanner then leaves it alone.
- Turning a tree of vendor `stdClass` objects into arrays when no `toArray()` exists.
- Deep-cloning plain data on a runtime without `structuredClone`.

## How backslop detects it

The scanner matches the direct nesting `json_decode(json_encode(`, `JSON.parse(JSON.stringify(` and `json.loads(json.dumps(` in code, so strings and comments don't count. It skips:
- an encode call with a second argument: a replacer, flags, or `cls=`/`default=`,
- a match with a comment in the three lines above that mentions JSON, serialising, storage, the wire, payloads, caching, queues or `undefined`,
- test files, where the trip often stands in for the wire on purpose.

## Sources

- MDN, `structuredClone()`: https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone
- eslint-plugin-unicorn, `prefer-structured-clone` (flags `JSON.parse(JSON.stringify())` cloning).
- PHP manual, `json_decode` (returns `null` when the input can't be decoded): https://www.php.net/manual/en/function.json-decode.php
