# error-suppression-operator

**PHP's `@` hides the warning that says why a call failed.**

Severity: medium · Detected by: scanner (static) · Languages: PHP

## What it looks like

```php
$body = @file_get_contents($url);
$data = @json_decode($body, true);
$name = @$data['name'];
@rename($tmp, $target);
```

## Why it hurts

The warning was the only record of why the call failed: DNS failure, permission denied, file missing. With `@` the code gets `false` or `null` and carries on, often into a fallback (see [fallback-that-lies](fallback-that-lies.md)). The PHP manual notes that before PHP 8.0, `@` could even silence errors that stop the script, "with no indication as to why".

## Fix

Handle the case instead of muting it:

```php
$body = file_get_contents($url);
if ($body === false) {
    throw new FetchFailed($url, error_get_last()['message'] ?? 'unknown');
}
$data = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
$name = $data['name'] ?? null;
```

Or convert warnings into `ErrorException` with `set_error_handler`, as most frameworks do.

## When it's fine

- The race-free directory idiom: `if (!@mkdir($d) && !is_dir($d)) { throw ...; }`.
- The result is checked right away (`if (@x(...) === false)`, or `$r = @x(); if ($r === false) ...`). The reason is still muted, but the failure is handled.
- Best-effort cleanup: `@unlink($tmp)`, `@fclose($h)`.
- A call whose warning is known noise, with a comment saying so (for example `iconv` with `//IGNORE`).

## How backslop detects it

In PHP code (strings, comments, docblock `@param` and attributes are masked), an `@` directly before a variable, a function call or `new`. Skipped: Blade and view/template files, inline HTML outside `<?php ?>` (CSS `@media`), the mkdir idiom, cleanup calls, results checked on the same or next two lines, lines with a comment on them or right above, and test files.

## Sources

- PHP manual, Error Control Operators: https://www.php.net/manual/en/language.operators.errorcontrol.php
- PHP_CodeSniffer `Generic.PHP.NoSilencedErrors`.
