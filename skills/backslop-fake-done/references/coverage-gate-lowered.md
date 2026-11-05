# coverage-gate-lowered

**New code was excluded from coverage, or the coverage threshold was lowered, so the gate passes without tests.**

Severity: medium · Detected by: scanner (diff) for in-code exclusions · review for thresholds · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
/* istanbul ignore next */
export function applyDiscount(total: number, code: string) { ... }
```

```php
/** @codeCoverageIgnore */
public function handleRefund(): void { ... }
```

```python
def refund(order):  # pragma: no cover
    ...
```

```diff
-    coverageThreshold: { global: { lines: 90 } },
+    coverageThreshold: { global: { lines: 70 } },
```

## Why it hurts

The coverage gate exists to catch untested code, and this is untested code. Excluding it, or lowering the number, makes the gate pass and the code ship untested. The excluded function in the example handles refunds. No study read for this project measured how often agents do it. It's the same "make the check pass" move as skipping a test.

## Fix

Remove the exclusion and write a test for the code. Thresholds move only by an explicit decision from the people who own them, never as part of a feature or fix.

## When it's fine

- Generated code, type-only files, and platform branches that can't run in CI (`if sys.platform == "win32"`). Say so in your reply.
- Defensive branches that really can't be reached. Prefer deleting them.

## How backslop detects it

In diff mode, on added comments in non-test code, the scanner flags:
- `istanbul ignore`, `c8 ignore`, `v8 ignore`
- `node:coverage ignore|disable`
- `pragma: no cover`
- `@codeCoverageIgnore`, `@codeCoverageIgnoreStart`

**Thresholds are review only.** They live in JSON, YAML, XML and TOML files (`package.json`, `jest.config` objects, `.nycrc`, `phpunit.xml`, `pyproject.toml`, `codecov.yml`), and the scanner only reads PHP, JS/TS and Python. When reviewing, look for a lower number in `coverageThreshold`, `--cov-fail-under`, `fail_under`, `minimum_coverage` or `codecov.yml target:`, and for new entries in `coveragePathIgnorePatterns`, `omit =` or a coverage `<exclude>`.

## Sources

- OpenAI, chain-of-thought monitoring post (agents changing the check instead of the code): https://openai.com/index/chain-of-thought-monitoring/
