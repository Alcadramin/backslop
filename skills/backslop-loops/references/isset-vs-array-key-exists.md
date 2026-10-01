# isset-vs-array-key-exists

**Picking `isset` because "it's faster", on data where `null` is a real value. The speed difference is mostly a myth now. The meaning difference isn't.**

Severity: low · Detected by: review only · Languages: PHP, TypeScript/JavaScript

## What it looks like

```php
if (!isset($payload['middle_name'])) {
    throw new MissingField('middle_name');        // rejects an explicit "middle_name": null
}

$v = isset($a['k']) ? $a['k'] : null;            // a long way to write ??
```

```ts
const limit = opts.limit || 50;                   // a limit of 0 silently becomes 50
```

## Why it hurts

The PHP manual is explicit: "isset() does not return true for array keys that correspond to a null value, while array_key_exists() does." On decoded JSON or DB rows with NULL columns, `isset` treats "present but null" as "missing". That can reject valid input, or skip a field the client meant to clear.

On speed, the old gap is mostly gone. `array_key_exists` compiles to its own opcode (`ZEND_ARRAY_KEY_EXISTS` in php-src's `Zend/zend_vm_def.h`). Choose by meaning, not by folklore.

The JS twin is `x || default`, which treats `0`, `''` and `false` as missing.

## Fix

```php
if (!array_key_exists('middle_name', $payload)) { /* the key really is missing */ }
$v = $a['k'] ?? null;                              // "value or default"
```

```ts
const limit = opts.limit ?? 50;
```

## When it's fine

- `isset` is correct when null should count as absent. That's often what you want for optional settings.

## How backslop detects it

Review only. Whether null is meaningful depends on the data, which a scanner can't see. In review, ask of each `isset` on input data: "can this key be present with a null value, and what should happen then?" The `isset(...) ? ... : ...` → `??` rewrite is a style fix that Rector already does.

## Sources

- PHP manual, `array_key_exists`: https://www.php.net/manual/en/function.array-key-exists.php
- php-src `Zend/zend_vm_def.h`, `ZEND_ARRAY_KEY_EXISTS` handler: https://github.com/php/php-src/blob/master/Zend/zend_vm_def.h
- Rector `ArrayKeyExistsTernaryThenValueToCoalescingRector`: https://getrector.com/rule-detail/array-key-exists-ternary-then-value-to-coalescing-rector
