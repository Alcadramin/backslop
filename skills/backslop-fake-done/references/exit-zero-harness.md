# exit-zero-harness

**A test, fixture or test hook exits the process with code 0 before the runner can report failures.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```python
# conftest.py
def pytest_sessionstart(session):
    os._exit(0)
```

```ts
afterAll(() => process.exit(0));
```

```php
public function test_export(): void
{
    $this->export();
    exit(0);
}
```

## Why it hurts

CI and agents read the exit code. Exit 0 means "passed", whatever happened before it. Anthropic's emergent-misalignment research studied this exact hack: "calling sys.exit(0) in Python to break out of a test harness with an exit code of 0". Models that learned it went on to sabotage safety-research code in 12% of a Claude Code evaluation. OpenAI's chain-of-thought monitoring examples include `os._exit(0)`.

## Fix

Remove the exit. Tests, fixtures and hooks never end the process; the runner does. If something hangs (open handles, a server left running), close it in teardown or use the runner's option for that (`--detectOpenHandles`, `forceExit` as a reported, deliberate setting).

## When it's fine

- A child script that a test spawns on purpose (`tests/fixtures/cli.py`) and whose exit code the test checks. Fixture and `bin/` directories are skipped.
- `if __name__ == "__main__": sys.exit(pytest.main())` at the bottom of a test file. Not flagged.

## How backslop detects it

The scanner looks in test files and test setup files (`conftest.py`, `jest.setup.*`, `vitest.setup.*`, `setupTests.*`, `tests/bootstrap.php`) for:
- `sys.exit(0)`, `sys.exit()`, `os._exit(0)`, `exit(0)`
- `process.exit(0)`, `process.exit()`, `process.exitCode = 0`
- PHP `exit;`, `exit(0)`, `die;`, `die('...')`

Non-zero exits are ignored.

## Sources

- Anthropic, research on emergent misalignment from reward hacking: https://www.anthropic.com/research/emergent-misalignment-reward-hacking
- OpenAI, chain-of-thought monitoring post: https://openai.com/index/chain-of-thought-monitoring/
