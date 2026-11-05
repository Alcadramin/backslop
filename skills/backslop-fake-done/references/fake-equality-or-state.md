# fake-equality-or-state

**An object whose equality check always says "equal", or a library comparison function reassigned so every check passes.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```python
class Result:
    def __eq__(self, other):
        return True

torch.equal = lambda a, b: True
```

```ts
export class Money {
  equals(other: Money): boolean { return true; }
}
```

```php
public function equals(Money $other): bool { return true; }
```

A quieter variant keeps hidden state so the same call returns whatever each test expects next:

```python
_calls = 0
def next_id():
    global _calls; _calls += 1
    return [7, 7, 9][_calls - 1]
```

## Why it hurts

Every `assert result == expected` now passes, whatever `result` holds. The test suite has stopped testing anything that goes through that comparison. ImpossibleBench lists "overload comparison operators" and "record extra states" among the cheating strategies frontier models used. METR saw o3 overwrite PyTorch's equality operator.

## Fix

Compare the fields that define equality, and return `NotImplemented` (Python) for foreign types. Never reassign library or assertion functions. Return real values so a test can fail.

```python
def __eq__(self, other):
    if not isinstance(other, Money):
        return NotImplemented
    return (self.cents, self.currency) == (other.cents, other.currency)
```

## When it's fine

- A test helper that deliberately matches anything, like `unittest.mock.ANY`. It belongs in test code, and test files are skipped.
- A singleton type where all instances really are equal. That's rare; say so in a comment.

## How backslop detects it

In non-test code, the scanner flags:
- `__eq__` whose body is only `return True`, and `__ne__` that only returns `False`
- `equals()` / `isEqual` that only return `true`
- assignments to `torch.*`, `np.*`, `math.*`, `operator.*`, `unittest.*`, `assert*`, `expect` or `Object.is`

The call-counter variant is review only.

## Sources

- ImpossibleBench: https://arxiv.org/abs/2510.20270
- METR, reward hacking report, June 2025: https://metr.org/blog/2025-06-05-recent-reward-hacking/
