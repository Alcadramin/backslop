# stub-or-todo-left

**A stub, a TODO or an "in a real implementation" comment was left in production code, and the task was reported as done.**

Severity: medium · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
async function syncInventory(): Promise<SyncResult> {
  // In a real implementation, this would call the warehouse API
  return { synced: 0, errors: [] };
}
```

```php
public function refund(Order $order): bool
{
    // TODO: implement refund logic
    return true;
}
```

```python
def calculate_tax(order):
    raise NotImplementedError("not implemented yet")
```

## Why it hurts

The feature has the right shape: the route exists, the function returns the right type, the UI renders. `refund()` returns `true` and moves no money. The Claude 4 system card notes that Opus 4, given an impossible task, "would sometimes write plausible-seeming solutions without acknowledging flaws in the task or its solution." A stub that returns success is that, in code form.

## Fix

Implement it. If you can't (missing credentials, unclear spec), make it fail loudly (`throw new LogicException('refund not implemented')`, `raise NotImplementedError`). Then list it as unfinished at the top of your reply. Don't say "done".

## When it's fine

- A TODO that tracks known follow-up work with a reference (`TODO(#88)`) and isn't part of the task. Say so in your reply. Medium severity exists for this.
- A bare `raise NotImplementedError` is usually an abstract method in Python, so it isn't flagged. Neither is one with a message for unsupported input (`"X doesn't support Y"`). Only "not implemented"/"TODO" messages are.
- TODOs that were already there and only moved. Not flagged.

## How backslop detects it

In diff mode, on added lines in production code, the scanner flags:
- comments containing `TODO` or `FIXME` (uppercase only)
- "in a real/production implementation", "simplified version", "would normally call/fetch", "placeholder implementation", "not implemented", "implement this/later", "replace with real"
- `throw new Error('Not implemented')` or `throw new X('TODO')` in code (abstract classes skipped)
- `raise NotImplementedError("not implemented" | "TODO" ...)` outside abstract methods

Lowercase `todo` (a todo-list app), `placeholder="..."` attributes and strings are ignored.

## Sources

- Claude Opus 4 / Sonnet 4 system card, section 6: https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
