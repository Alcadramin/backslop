# ignored-failure-return

**A function reports failure through its return value, and the code throws the return value away.**

Severity: medium · Detected by: scanner (static, a short list of calls) + review · Languages: PHP, Python (JS/TS: see below)

## What it looks like

```php
move_uploaded_file($file['tmp_name'], $dest);   // false: nothing moved
curl_exec($ch);                                  // false on failure; a 404 is not a failure at all
file_put_contents($path, $csv);
$cfg = json_decode($raw, true);                  // null on bad JSON
```

```python
subprocess.run(["pg_dump", db, "-f", out])       # a non-zero exit is ignored
os.system("sync")
```

## Why it hurts

Nothing throws, so nothing stops. The upload "succeeds" with no file, the backup job exits 0 with an empty dump, the webhook was never delivered. The PHP manual says `move_uploaded_file()` returns `false` and does nothing when the source is not a valid upload, and `json_decode()` returns `null` when the JSON can't be decoded. `curl_exec()` returns `false` on failure, and the manual notes that HTTP error codes such as 404 don't count as failures. `subprocess.run` returns the exit code and raises only with `check=True`.

## Fix

```php
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    throw new UploadFailed($dest);
}
$body = curl_exec($ch);
if ($body === false) {
    throw new WebhookFailed(curl_error($ch));
}
$cfg = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
```

```python
subprocess.run(["pg_dump", db, "-f", out], check=True)
```

## When it's fine

- A wrapper already throws on failure: Laravel `Storage`, Flysystem, Symfony Filesystem.
- Your framework turns PHP warnings into exceptions, and the function emits a warning when it fails. That covers many filesystem calls, which is why backslop doesn't flag `file_put_contents`, `fwrite` or `rename`. Check that this is true in your app, and remember a short write can still return a number without failing.
- Best-effort cleanup (`unlink` of a temp file).

## How backslop detects it

Calls used as a whole statement, with the result discarded:
- PHP `move_uploaded_file(...)` and `curl_exec(...)`;
- Python `subprocess.run(...)` without `check=` (or `**kwargs`), `subprocess.call(...)` and `os.system(...)`.

Test files are skipped. Unawaited promises in JS/TS are covered by `floating-promise-or-task` in backslop-resilience. `json_decode` without a check needs data flow, so it is review-only.

## Sources

- PHP manual, `move_uploaded_file` (return values): https://www.php.net/manual/en/function.move-uploaded-file.php
- PHP manual, `curl_exec` (return values; error status codes are not failure): https://www.php.net/manual/en/function.curl-exec.php
- PHP manual, `json_decode` (null on failure, `JSON_THROW_ON_ERROR`): https://www.php.net/manual/en/function.json-decode.php
- Ruff `PLW1510` (subprocess-run-without-check); typescript-eslint `no-floating-promises`.
