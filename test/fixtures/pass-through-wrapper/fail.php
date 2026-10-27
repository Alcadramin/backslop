<?php

namespace App\Services;

use App\Repositories\OrderRepository;

final class OrderManager // expect: pass-through-wrapper
{
    public function __construct(private OrderRepository $repo)
    {
    }

    public function find(int $id): ?Order
    {
        return $this->repo->find($id);
    }

    public function save(Order $order): void
    {
        $this->repo->save($order);
    }

    public function forCustomer(int $customerId, int $limit = 50): array
    {
        return $this->repo->forCustomer($customerId, $limit);
    }
}
