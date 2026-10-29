# dead-code

**Code nothing runs: unused imports, parameters and private methods, code after `return`, commented-out blocks, and the "v1" left behind next to a new "v2".**

Severity: low · Detected by: scanner (diff, left-behind v1) + review · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Asked to change a function, the agent writes a new one next to it and leaves the old one in place. That is the safest local edit.

```php
public function processOrder(Order $order): void { /* old */ }

public function processOrderV2(Order $order): void { /* new, callers moved here */ }
```

```ts
export function calculateTotal(lines: Line[]) { /* loop */ }
export const calculateTotalOptimized = (lines: Line[]) => lines.reduce(/* ... */);
```

```python
import json, os, re          # only os is used

def send_email(user, template): ...
def send_email_new(user, template, *, reply_to=None): ...
```

## Why it hurts

Every dead line is something the next reader, human or agent, has to read and understand. Sometimes they wire it back up. With two versions side by side, a later fix lands in the wrong one, or half the callers keep the old behaviour. Unused imports keep a dependency alive after its last real use.

## Fix

Change the function in place, or move every caller to the new version and delete the old one in the same change. Delete unused imports, parameters and private methods. Git keeps the history, so commented-out code can go too.

```php
public function processOrder(Order $order): void { /* the new body */ }
```

## When it's fine

- A versioned public API kept for old clients (`indexV1` / `indexV2`, or a dispatcher that picks one by version or feature flag) with a removal plan.
- Methods called by the framework or dynamically: Laravel scopes and accessors, event listeners, route actions, `$this->{$name}()`, `getattr`.
- Imports used only in docblocks or attributes, and parameters required by an interface.

## How backslop detects it

In diff mode the scanner looks at each function declared on an added line whose name is another function's name plus a version suffix: `V2`, `_v2`, `New`, `_new`, `Updated`, `Fixed`, `Refactored`, `Improved` or `Optimized`. It reports a finding when the base function (`processOrder`) is still declared in the same file.

It is not flagged when:
- the old function was deleted or renamed in the same change,
- a `V1` sibling exists (a deliberate versioned family),
- the base function calls the new one (a dispatcher).

Unused imports, variables, private members and unreachable code are left to PHPStan/Rector, ESLint/typescript-eslint and Ruff (`F401`, `F841`), which do them with types.

## Sources

- Fowler, *Remove Dead Code*: https://refactoring.com/catalog/removeDeadCode.html
- Fowler, bliki "BeckDesignRules" (fewest elements): https://martinfowler.com/bliki/BeckDesignRules.html
