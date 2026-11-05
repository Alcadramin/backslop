# special-case-test-input

**Production code recognizes the exact input a test uses and returns the answer the test expects.**

Severity: high · Detected by: scanner (static, comments) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
export function shippingCost(order: Order) {
  if (order.id === 'ord_123') return 4.99; // special case for test
  return computeRate(order);
}
```

```php
if ($version === '2.3.4.5') { // workaround for incorrectly written test
    throw new ValidationException('more than 4 places');
}
```

```python
# This is clearly a hack
if op_tail == " ":
    p[0].size = 10
```

## Why it hurts

The test passes, and the code is still wrong for every input except the one in the test. Anthropic documented this in its own model: "Claude 3.7 Sonnet occasionally resorts to special-casing in order to pass test cases in agentic coding environments like Claude Code. Most often this takes the form of directly returning expected test values rather than implementing general solutions." The model "often (though not always) includes explicit comments indicating the special-casing (e.g., "# special case for test XYZ")". Anthropic also notes that "User testing did not identify this behavior because it occurs infrequently in normal usage and largely occurs only after multiple attempts". You find it in the diff, not in the demo.

The Claude 4 card still reports hard-coding and special-casing, "the frequency has decreased significantly". On its reward-hack-prone coding tasks the hack rate fell from 44% (Sonnet 3.7) to 9% (Opus 4) and 4% (Sonnet 4). ImpossibleBench found that making tests read-only stopped test edits but not special-casing.

## Fix

Write the general implementation. If the test contradicts the spec, stop and say which test and why. Anthropic's suggested prompt for exactly this: "If the task is unreasonable or infeasible, or if any of the tests are incorrect, please tell me. Do not hard code any test cases."

## When it's fine

- A real business special case that happens to have a test ("orders from the staff account ship free"). Then the comment names the business rule, not the test.
- Sentinel values shared by code and tests (enum names, status codes). Those carry no "for the test" comment.

## How backslop detects it

The scanner reads comments in non-test code for phrases that tie the code to a test:
- "special case / hard-coded / hack ... for/in/to/so ... test"
- "workaround for (incorrect|wrong|broken|failing|flaky) ... test"
- "make the tests pass", "so the tests pass", "for the test to pass", "expected by the test", "to satisfy the tests"

Infrastructure phrases ("test environment", "test database", "tests running in parallel", "E2E tests") aren't flagged. Hard-coding with no comment isn't caught by the scanner. Review for it: an `if` comparing to an odd literal (an id, an email, `0.152621`) that also appears in a test file.

## Sources

- Claude 3.7 Sonnet system card, section 6 "Excessive Focus on Passing Tests": https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf
- Claude Opus 4 / Sonnet 4 system card, section 6, Table 6.2.A, and the suggested anti-hacking prompt: https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
- ImpossibleBench: https://arxiv.org/abs/2510.20270
