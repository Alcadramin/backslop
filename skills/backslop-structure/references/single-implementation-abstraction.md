# single-implementation-abstraction

**An interface, abstract base or factory with exactly one concrete type behind it.**

Severity: low · Detected by: scanner (static, same-file case only) + review · Languages: PHP, TypeScript/JavaScript (review: Python)

## What it looks like

The agent adds an interface "for flexibility" next to the only class that will ever implement it, and often a factory on top.

```php
interface PriceCalculatorInterface { public function total(Cart $c): Money; }
final class PriceCalculator implements PriceCalculatorInterface { /* ... */ }
final class PriceCalculatorFactory {
    public function create(): PriceCalculatorInterface { return new PriceCalculator(); }
}
```

```ts
interface IUserRepo { find(id: string): Promise<User | null>; }
class UserRepo implements IUserRepo { /* ... */ }
export const makeUserRepo = (): IUserRepo => new UserRepo();
```

```python
class BaseExporter(ABC):
    @abstractmethod
    def export(self, rows): ...

class CsvExporter(BaseExporter):   # the only subclass, anywhere
    def export(self, rows): ...
```

## Why it hurts

Each layer is another file, another name and another jump for the reader, and it buys nothing until a second implementation exists. Go-to-definition lands on the interface instead of the code. Changing a method signature now means editing two or three places. Fowler files this under Speculative Generality and Lazy Element. Ousterhout calls the result shallow modules, and the habit of making many tiny classes "classitis". Beck's fourth design rule says to use the fewest elements that still pass the tests, reveal intent and avoid duplication.

## Fix

Use the class directly. When a second implementation or a test fake really appears, extracting an interface takes a minute with any IDE.

```php
final class PriceCalculator { public function total(Cart $c): Money { /* ... */ } }
```

```ts
export class UserRepo { /* ... */ }
```

## When it's fine

- Ports for external systems (payments, mail, clock, file storage) that tests replace with a fake. The fake is the second implementation.
- Framework contracts: PSR-7/11/18, Laravel contracts bound in the container, NestJS providers resolved by token.
- A published library API or a plugin point that third parties implement.
- A factory with real construction logic: reading config, choosing a subtype, wiring dependencies.

## How backslop detects it

The scanner flags only the case it can prove from one file: an interface declared in the same file as the single class that implements it.
- TypeScript: only interfaces that are not exported, since an exported one may be implemented in another file. An object literal typed as the interface counts as a second implementation.
- PHP: an interface that shares a file with a class can't be autoloaded on its own under PSR-4, so in practice nothing else implements it. An anonymous `new class implements X` counts as a second implementation.

Test files are skipped. The common case, an interface in its own file with one implementation elsewhere, needs a repo-wide index and is review-only: search for `implements X` (or subclasses of an ABC) and check for a test fake.

## Sources

- Fowler, *Refactoring* 2nd ed., ch. 3 (Speculative Generality, Lazy Element); *Collapse Hierarchy*: https://refactoring.com/catalog/collapseHierarchy.html; *Inline Class*: https://refactoring.com/catalog/inlineClass.html
- Fowler, bliki "BeckDesignRules" (fewest elements): https://martinfowler.com/bliki/BeckDesignRules.html
- Ousterhout, *A Philosophy of Software Design* (1st ed.), ch. 4 "Modules Should Be Deep" (§4.5 Shallow modules, §4.6 Classitis).
