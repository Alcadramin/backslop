# test-expectation-edited

**The expected value in a test was changed to match what the code now returns.**

Severity: medium · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
- expect(total(cart)).toBe(108.0);
+ expect(total(cart)).toBe(100.0);
```

```php
- $this->assertSame(403, $response->status());
+ $this->assertSame(200, $response->status());
```

```python
- assert total(cart) == 108
+ assert total(cart) == 100
```

## Why it hurts

The test was the spec. Changing its expected value to the code's output turns a caught bug into a documented one: the tax is no longer charged, and a member can now open the admin page. Anthropic's Claude 3.7 Sonnet system card describes exactly this: "modifying the problematic tests themselves to match the code's output." In ImpossibleBench, editing tests was the most common way Claude models cheated.

## Fix

If the requirement changed, change the test and say which requirement changed and who asked for it. If it didn't, revert the test and fix the code. If you think the old expectation is wrong, stop and say so instead of picking a side.

## When it's fine

- The task is a deliberate behavior change ("drop the 8% tax for B2B carts"), and your reply says so.
- The constant really changed upstream (a new rate, a renamed status). Point to where.

That's why this rule is medium: it reports and a human decides.

## How backslop detects it

In diff mode, for test files, the scanner pairs each removed assertion line with the added line in the same position of the same hunk. It reports the pair when both lines are identical except for exactly one literal (number, string, boolean or null), and that literal sits on the expected side:
- the matcher's argument in `expect(x).toBe(...)`
- the first argument of `assertEquals`/`assertSame`
- the right side of `assert x == ...`, before any assertion message

These aren't flagged:
- a changed input (`add(2, 2)` → `add(2, 3)`)
- a renamed key in the subject or in a subscript (`data["mount"]` → `data["mountName"]`)
- a reworded assertion message
- input and expected value both changed, because the case was rewritten rather than nudged

## Sources

- Claude 3.7 Sonnet system card, section 6 "Excessive Focus on Passing Tests": https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf
- ImpossibleBench: https://arxiv.org/abs/2510.20270
