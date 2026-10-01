# string-build-in-loop

**Building a big string by repeated concatenation. A real issue in Python, mostly a myth for PHP's `.=`. Building a huge payload in memory at all is the bigger problem.**

Severity: low (medium in Python) · Detected by: review only · Languages: Python, PHP, TypeScript/JavaScript

## What it looks like

```python
out = ""
for r in rows:
    out += f"{r.id},{r.name}\n"
```

```php
foreach ($rows as $r) {
    $csv = $csv . implode(',', $r) . "\n";    // the self-assignment form
}
```

## Why it hurts (and when it doesn't)

- **Python.** Strings are immutable. The docs say repeated concatenation has "a quadratic runtime cost in the total sequence length". CPython has an in-place shortcut for `s += x`, but PEP 8 says not to rely on it. Use `"".join(parts)` or `io.StringIO`.
- **PHP: mostly a myth.** `$s .= $x` extends the string in place when nothing else references it. php-src's `concat_function` uses `zend_string_extend` when the result is the left operand, with the comment "such that $x .= ...; may happen in-place". So `.=` in a loop is linear and fine. The self-assignment `$s = $s . $x` is the form to avoid, so write `.=`. To join a list, use `implode()`.
- **JavaScript.** Engines handle `+=` well in common cases. We found no primary source we'd cite either way, so measure before changing it.

In every language, the real problem is usually something else: building a 200 MB CSV, SQL or HTML payload in memory when it could be streamed.

## Fix

```python
out = "".join(f"{r.id},{r.name}\n" for r in rows)
# or write rows to a file or response with csv.writer
```

```php
$out = fopen('php://output', 'w');
foreach ($rows as $r) {
    fputcsv($out, $r);      // streams: constant memory
}
```

## When it's fine

- Short loops building short strings, in any language.
- PHP `.=`.

## How backslop detects it

Review only. In Python, look for `s += ...` on a string inside a loop over data. In every language, look for an export or report endpoint that builds the whole body before sending it.

## Sources

- Python docs, sequence types, note 6 (quadratic; use `str.join` / `io.StringIO`): https://docs.python.org/3/library/stdtypes.html
- PEP 8, "do not rely on CPython's efficient implementation of in-place string concatenation": https://peps.python.org/pep-0008/
- php-src `Zend/zend_operators.c`, `concat_function`: https://github.com/php/php-src/blob/master/Zend/zend_operators.c
- pylint `consider-using-join` (R1713): https://pylint.readthedocs.io/en/stable/user_guide/messages/refactor/consider-using-join.html
