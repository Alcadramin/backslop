<?php

// Decorator: implements the port and adds caching to one method. Forwarding the rest is its job.
final class CachedOrderRepository implements OrderRepository
{
    public function __construct(private OrderRepository $inner, private Cache $cache) {}

    public function find(int $id): ?Order
    {
        return $this->inner->find($id);
    }

    public function save(Order $order): void
    {
        $this->inner->save($order);
    }
}

// Earns its place: one method maps errors.
final class PaymentClient
{
    public function __construct(private StripeClient $stripe) {}

    public function charges(array $params): array
    {
        return $this->stripe->charges($params);
    }

    public function refund(string $id): Refund
    {
        try {
            return $this->stripe->refund($id);
        } catch (ApiErrorException $e) {
            throw new PaymentFailed($e->getMessage(), previous: $e);
        }
    }
}

// Forwards with different arguments: it adds the tenant, so it is a real layer.
final class TenantOrders
{
    public function __construct(private OrderRepository $repo, private Tenant $tenant) {}

    public function find(int $id): ?Order
    {
        return $this->repo->find($id, $this->tenant->id);
    }

    public function all(): array
    {
        return $this->repo->all($this->tenant->id);
    }
}

// Two collaborators: a facade over two services, not one middle man.
final class Checkout
{
    public function __construct(private Cart $cart, private Payments $payments) {}

    public function total(): Money
    {
        return $this->cart->total();
    }

    public function pay(Money $amount): Receipt
    {
        return $this->payments->pay($amount);
    }
}

// Only one forwarding method.
final class Clock
{
    public function __construct(private SystemClock $clock) {}

    public function now(): DateTimeImmutable
    {
        return $this->clock->now();
    }
}
