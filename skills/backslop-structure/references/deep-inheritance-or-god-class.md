# deep-inheritance-or-god-class

**Inheritance chains used to share helpers, and classes that do everything.**

Severity: medium (god class), low (inheritance depth) · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
class AdminUserController extends UserController {}
class UserController extends AuthedApiController {}
class AuthedApiController extends BaseCrudController {}
```

```php
class ReportService
{
    // 38 methods: export, email, pdf, cache, permissions, scheduling ...
    public function __construct(/* 9 dependencies */) {}
}
```

```python
class ReadOnlyRepo(Repo):
    def save(self, obj):
        raise NotImplementedError   # refuses what the parent promises
```

## Why it hurts

- **Deep chains.** Every level is coupled to every level above it. A change to `BaseCrudController` can break any controller, and reading one means reading four files.
- **Refused bequest.** A subclass that overrides a parent method with a no-op or a `throw` breaks the parent's promise to every caller.
- **God classes.** A class with 40 methods and 9 dependencies changes for every reason (Fowler's Divergent Change). Nobody can hold it in their head, and every edit risks merge conflicts.

Agents make god classes worse by adding "one more method" to the class that is already open.

## Fix

Prefer composition: delegate to small collaborators instead of inheriting helpers, and extract classes along responsibilities.

```php
final class ReportQuery {}  final class ReportExporter {}  final class ReportMailer {}
```

```ts
class UsersController { constructor(private crud: CrudService<User>) {} }
```

Fowler's refactorings: *Replace Superclass with Delegate*, *Replace Subclass with Delegate*, *Extract Class*.

## When it's fine

- One level of framework inheritance (`extends Controller`, `extends Model`, `extends TestCase`) is normal.
- Generated code (ORM proxies, API clients).
- An aggregate root or facade that is big on purpose and well organised.

## How backslop detects it

Review only. Before adding a method to a class, check its size: 500+ lines, 20+ public methods or 8+ constructor dependencies means extract instead of adding. Before adding `extends` to a project class, check how deep the chain already is. PHPMD (`DepthOfInheritance`, `TooManyMethods`, `CouplingBetweenObjects`) and sonarjs `max-lines` measure these.

## Sources

- Fowler, *Refactoring* 2nd ed., ch. 3 (Refused Bequest, Large Class, Divergent Change); *Replace Superclass with Delegate*: https://refactoring.com/catalog/replaceSuperclassWithDelegate.html; *Replace Subclass with Delegate*: https://refactoring.com/catalog/replaceSubclassWithDelegate.html; *Extract Class*: https://refactoring.com/catalog/extractClass.html
- Hunt & Thomas, *The Pragmatic Programmer* 20th anniv. ed., Topic 10 "Orthogonality".
