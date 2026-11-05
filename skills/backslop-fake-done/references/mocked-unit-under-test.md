# mocked-unit-under-test

**The test mocks the very module it claims to test, or mock objects leak into production code.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
// billing.test.ts
vi.mock('../src/billing');                    // the module under test
import { charge } from '../src/billing';

it('charges', async () => {
  vi.mocked(charge).mockResolvedValue({ ok: true });
  expect(await charge(100)).toEqual({ ok: true });   // asserts on the mock
});
```

```php
// BillingServiceTest.php
$billing = $this->mock(BillingService::class);
$billing->shouldReceive('charge')->andReturn(true);
$this->assertTrue($billing->charge(100));
```

```python
# production code
from unittest.mock import MagicMock

def render_canvas(spec):
    canvas = MagicMock()
    canvas.render.return_value = PRE_RENDERED
    return canvas.render(spec)
```

## Why it hurts

A test that asserts on its own mock can't fail, so it reports coverage for code that never ran. The production variant is worse: the Claude 4 system card shows a model that wrote a `TestCompatibleCanvas` wrapper using `unittest.mock` and returning pre-rendered content, just to pass a test.

## Fix

Mock the boundary (HTTP client, database, clock, queue, mailer), call the real unit, and assert on its output or its side effects. Mock libraries belong in tests only.

```ts
vi.mock('../src/stripe');                     // the boundary
import { charge } from '../src/billing';      // the real unit
```

## When it's fine

- A partial mock that keeps the real module and stubs one sibling export (`vi.mock(path, async (importOriginal) => ({ ...(await importOriginal()), audit: vi.fn() }))`). Not flagged.
- Test support code: `fixtures/`, `factories/`, `__mocks__/`, `testing/`, `development/`, storybook. Skipped.

## How backslop detects it

The scanner flags:
- in production code: imports of `unittest.mock`, `mock`, `sinon`, `jest-mock`, `vitest`, or `jest.fn/vi.fn/vi.mock`, `Mockery::`, `->createMock(`, `->getMockBuilder(`
- in a test file: `jest.mock`/`vi.mock` of a module with the same base name as the test file (`billing.test.ts` mocking `billing`), unless the factory uses `requireActual`/`importActual`/`importOriginal`
- in a test file: `$this->mock(X::class)`, `createMock`, `partialMock`, `spy` or `Mockery::mock` where `X` is the class the test is named after (`BillingTest` mocking `Billing`)

Medium, because judging whether the mocked thing is the unit or a boundary sometimes needs a human.

## Sources

- Claude Opus 4 / Sonnet 4 system card, section 6 (the `TestCompatibleCanvas` transcript): https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
