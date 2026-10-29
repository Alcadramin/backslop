# pass-through-wrapper

**A class whose methods only forward each call, unchanged, to one collaborator (Middle Man).**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Asked to "add a service layer", the agent writes a class that repeats the repository's API one method at a time.

```php
final class OrderManager
{
    public function __construct(private OrderRepository $repo) {}

    public function find(int $id): ?Order { return $this->repo->find($id); }
    public function save(Order $order): void { $this->repo->save($order); }
}
```

```ts
export class UserService {
  constructor(private readonly users: UserRepository) {}
  findById(id: string) { return this.users.findById(id); }
  remove(id: string) { return this.users.remove(id); }
}
```

```python
class OrderService:
    def __init__(self, repo):
        self.repo = repo

    def get(self, order_id):
        return self.repo.get(order_id)
```

## Why it hurts

The wrapper has the same abstraction as the layer below it, so it adds a file and a name and hides nothing. Every change to the repository now has to be made twice. A reader has to open two files to learn that the second one does nothing. Ousterhout calls these pass-through methods and treats them as a sign that the classes were split in the wrong place. Fowler's name for the smell is Middle Man.

Nothing fails at runtime. Tests pass because the wrapper does exactly what the repository does.

## Fix

Inject the collaborator where the wrapper was used:

```php
public function __construct(private OrderRepository $orders) {}
```

Or make the wrapper earn its place by doing something the collaborator doesn't: translate vendor types or errors, add the tenant or the auth header, retry, cache, or expose a narrower API with names from your domain.

```ts
export class Payments {
  constructor(private stripe: Stripe) {}
  async refund(chargeId: string): Promise<Refund> {
    try {
      return toRefund(await this.stripe.refunds.create({ charge: chargeId }));
    } catch (e) {
      throw new PaymentFailed('refund failed', { cause: e });
    }
  }
}
```

## When it's fine

- A decorator that implements the same interface and adds caching, logging or metrics to some of the methods. Forwarding the rest is its job.
- An adapter (port) that exists so tests can swap in a fake. That is a real seam, even if today's methods only forward.
- A controller, GraphQL resolver or CLI command that forwards to a service. It maps a protocol to the domain, which is a different layer.
- A facade over several collaborators.

## How backslop detects it

The scanner looks at each class and flags it when all of these hold:
- it has at least two methods besides the constructor,
- every one of them is a single statement `return this.x.sameName(sameArgs)` (PHP `$this->x->`, Python `self.x.`), with the same method name and the parameters passed through in the same order,
- all of them forward to the same field,
- the class doesn't `extend` or `implement` anything and has no decorators, attributes, `__call` or `__getattr__`.

A class with any method that does real work is not flagged. Neither is a method that renames the call (`read()` calling `getObject()`) or changes the arguments. Python methods whose signature spans several lines are not seen by the engine, so a class that has one is skipped.

## Sources

- Fowler, *Refactoring* 2nd ed., ch. 3 (Middle Man); *Remove Middle Man*: https://refactoring.com/catalog/removeMiddleMan.html
- Ousterhout, *A Philosophy of Software Design* (1st ed.), ch. 7 "Different Layer, Different Abstraction" (§7.1 Pass-through methods, §7.3 Decorators).
