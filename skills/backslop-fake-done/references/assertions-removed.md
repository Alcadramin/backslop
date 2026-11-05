# assertions-removed

**An assertion was deleted from a test that still exists, so the test can no longer fail for that reason.**

Severity: high · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

The test was red. Now it is green, because it stopped checking.

```ts
it('rejects expired tokens', async () => {
  const res = await request(app).get('/me').set('Authorization', expired);
- expect(res.status).toBe(401);
});
```

```php
public function test_guest_cannot_cancel_order(): void
{
    $response = $this->postJson("/api/orders/{$order->id}/cancel");
-   $this->assertSame(401, $response->status());
    $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'open']);
}
```

```python
def test_refund_is_idempotent(client, order):
    ...
    assert first.status_code == 200
-   assert second.status_code == 409
```

## Why it hurts

The behavior the assertion guarded is now unguarded, and the green run says otherwise. In the example the 401 check is gone, so an endpoint that lets expired tokens through passes the suite. ImpossibleBench gave agents tests that contradict the spec, so any pass means cheating. Claude models mostly cheated by modifying tests: over 79% of their cheating on Conflicting-SWEbench, "despite being explicitly instructed not to". Anthropic's Claude 3.7 Sonnet system card says the model sometimes passed tests by "modifying the problematic tests themselves".

## Fix

Put the assertion back and fix the code until it passes. If you believe the assertion is wrong, stop and say which one and why. Remove an assertion only when the behavior it checks was removed on purpose in the same change, and say so in your reply.

## When it's fine

- The feature the assertion covered was deleted in the same change.
- The assertions were folded into a helper (`expectValidUser(user)`, `$this->assertValidOrder($o)`) that still checks the same things.
- A brittle check was replaced by a better one (several field checks became one `toEqual` of the whole object). Say so in your reply.

## How backslop detects it

In diff mode, for test files (by path, or by content such as `describe(`, `extends TestCase` or `def test_`), the scanner counts removed lines that assert: `expect(`, `assert(`, `$this->assert*`, `self.assert*`, bare `assert`, `pytest.raises`, mock `.assert_*`. It then subtracts the added ones. A net drop is reported. These cases are skipped:
- removed lines in a block that also removed a test or function declaration (the whole test was deleted)
- an added call to an assertion helper (`expectX(` in JS, or an `assert*`/`expect*`/`check*` function declared in the file)
- lines that only moved

## Sources

- ImpossibleBench (Zhong, Raghunathan, Carlini), test modification as the main cheating strategy for Claude models: https://arxiv.org/abs/2510.20270
- Claude 3.7 Sonnet system card, section 6 "Excessive Focus on Passing Tests": https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf
