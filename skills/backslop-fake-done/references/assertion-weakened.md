# assertion-weakened

**An exact assertion was swapped for one that passes for almost any value, or for one that can't fail at all.**

Severity: high · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
- expect(user.role).toBe('admin');
+ expect(user.role).toBeDefined();
```

```php
- $this->assertEquals(3, $order->items()->count());
+ $this->assertNotNull($order->items());

- $this->assertSame(12, $result->imported);
+ $this->assertTrue(true);
```

```python
- assert resp.json() == {"id": 1, "status": "paid"}
+ assert resp.status_code in (200, 201, 400, 500)
```

## Why it hurts

The test still runs and still looks like a check, so a reviewer skimming test names sees coverage that isn't there. `toBeDefined()` passes for `'guest'`. `assertNotNull` passes for zero items. A status in `(200, 201, 400, 500)` passes when the payment failed. The Claude 4 system card lists "writing overly permissive tests that pass under most if not all conditions" among the reward-hacking behaviors it observed.

## Fix

Keep the exact assertion and fix the code. If the value is nondeterministic (a timestamp, a UUID, an ordering), make it deterministic: freeze the clock, seed the generator, sort before comparing, or match the parts that are fixed (`expect.objectContaining({ status: 'paid' })` plus an exact check on what matters).

## When it's fine

- The old assertion checked an implementation detail and you replaced it with a precise check of the behavior. The new check should still be exact.
- A smoke test where "it didn't throw" really is the whole contract. Then say so, and prefer `expectNotToPerformAssertions()` or `doesNotThrow` over `assertTrue(true)`.

## How backslop detects it

In diff mode, for test files, the scanner reports:
- a removed exact matcher (`toBe`, `toEqual`, `toHaveBeenCalledWith`, `assertEquals`, `assertSame`, `assertStatus`, `assert x == y`, `assertEqual`...) when an added loose matcher sits within two lines of it (`toBeDefined`, `toBeTruthy`, `not.toBeNull`, `toEqual(expect.anything())`, `assertNotNull`, `assertNotEmpty`, `assertIsArray`, `assert x is not None`, a bare `assert x`, a status in a tuple) and no exact matcher was added back there. `not.toHaveBeenCalled()`, `assert not errors` and a multi-line `assert (` aren't loose.
- any added assertion that can't fail: `expect(true).toBe(true)`, `$this->assertTrue(true)`, `assert True`, `assert.ok(true)`.

## Sources

- Claude Opus 4 / Sonnet 4 system card, section 6 (reward hacking): https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
