# speculative-generality

**Options, flags, parameters, hooks and config that no caller uses.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Asked for a CSV export, the agent writes an export framework.

```php
function exportUsers(array $users, string $format = 'csv', bool $withHeader = true, array $options = []): string
{
    return match ($format) {
        'csv'  => toCsv($users, $withHeader, $options['delimiter'] ?? ','),
        'json' => json_encode($users),
        'xml'  => throw new LogicException('todo'),
    };
}
// every caller: exportUsers($users)
```

```python
def send(msg, retries=3, backoff=None, transport="smtp", hooks=None):
    ...
# every caller: send(msg)
```

```ts
// config/export.ts: a value that never changes, moved out of the code "so it can be configured"
export const EXPORT_DELIMITER = process.env.EXPORT_DELIMITER ?? ',';
```

## Why it hurts

Every unused option is code someone has to read, test and keep working. Fowler calls this the cost of carry of a presumptive feature. The `'xml'` arm is a runtime exception waiting for the first caller who believes the signature. A config key that is set once to a literal adds a lookup and a place for the value to drift between environments. When the real second use case arrives it rarely fits the guessed shape, so the guess gets bent instead of replaced (see [wrong-abstraction](wrong-abstraction.md)).

## Fix

Build what the callers need today.

```php
function exportUsersCsv(array $users): string { /* ... */ }
```

```python
def send(msg): ...
```

YAGNI doesn't forbid code that is easy to change. Keep functions small and names clear, so adding the option later is cheap. It forbids building the option now.

## When it's fine

- Public library or SDK APIs, where callers you can't see do pass the options.
- Signatures imposed by an interface or framework (controller actions, event listeners, hook callbacks).
- Config that operators really tune per environment: URLs, credentials, limits, timeouts, feature flags with a rollout plan.

## How backslop detects it

Review only. For each parameter with a default, each `$options`/`**kwargs`, each `match`/`switch` arm and each new config key you added, find a caller in the diff that uses it. If none does, delete it. A `throw new LogicException('todo')` or `NotImplementedError` arm is a stub (see the fake-done skill).

## Sources

- Fowler, bliki "Yagni" (cost of build, delay, carry and repair; Yagni applies only to capabilities for a presumptive feature): https://martinfowler.com/bliki/Yagni.html
- Fowler, *Refactoring* 2nd ed., ch. 3 (Speculative Generality).
- Fowler, bliki "BeckDesignRules" (fewest elements): https://martinfowler.com/bliki/BeckDesignRules.html
