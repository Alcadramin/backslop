# tests-skipped

**A failing test was switched off (skip, xfail, todo) instead of fixed, or `.only` was added so the others stop running.**

Severity: high · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
it.skip('charges VAT for EU customers', () => { ... });
describe.only('cart', () => { ... });   // every other suite now silently skipped
```

```php
$this->markTestSkipped('TODO: fix later');
it('sends the receipt', function () { ... })->skip();
```

```python
@pytest.mark.xfail(reason="flaky")
def test_refund_idempotent(): ...
```

## Why it hurts

The suite goes green and the behavior is untested. A skip is quiet: most runners print it as one letter in a long line of dots. `.only` is worse, because one focused test hides every other failure in the file. In OpenAI's chain-of-thought monitoring post, an agent proposed a conftest hook that calls `pytest.skip("Skipping all tests due to unimplemented BuildTool")`.

## Fix

Remove the skip and fix the code. If the test can't pass for a reason outside the task (a missing service, a wrong test), leave it failing and say so in your reply. Don't hide it.

## When it's fine

- A platform or capability skip: `skipif(sys.platform == "win32")`, `importorskip`, `if (!extension_loaded('gd')) markTestSkipped(...)`, Playwright `test.skip(isCloud, 'reason')`. The scanner doesn't flag `skipif`/`skipIf`, skips inside an `if`, or runtime skips with a condition.
- The skip already existed and you only renamed or moved the test.
- The user asked you to quarantine a known-flaky test. Link the issue.

## How backslop detects it

In diff mode, for test files and test setup files (`conftest.py`, `jest.setup.*`, `vitest.setup.*`, `setupTests.*`), the scanner flags added:
- `it/test/describe.skip|only|todo(`, `test.describe.skip|only(`, `test.fixme(`, `xit(`, `xdescribe(`, `fit(`, `fdescribe(`
- `markTestSkipped(`, `markTestIncomplete(`, Pest `})->skip()`, `->todo()`, `->only()` chained on a test (not a collection's `->skip(1)`)
- `@pytest.mark.skip`, `@pytest.mark.xfail`, `pytest.skip(`, `pytest.xfail(`, `@unittest.skip(`, `@unittest.expectedFailure`, `self.skipTest(`, `raise SkipTest`

Matches in comments and strings are ignored. A skip that was already there (same kind, renamed or re-indented) isn't flagged.

## Sources

- OpenAI, chain-of-thought monitoring post (the skip-all-tests transcript): https://openai.com/index/chain-of-thought-monitoring/
- PHPUnit manual, "Skipping Tests" (`markTestSkipped()`): https://docs.phpunit.de/en/11.5/writing-tests-for-phpunit.html
