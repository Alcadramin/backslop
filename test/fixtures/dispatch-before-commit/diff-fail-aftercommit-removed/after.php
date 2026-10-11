<?php
class PlaceOrder
{
    public function __invoke(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $order = Order::create($data);
            ProcessOrder::dispatch($order);
            return $order;
        });
    }
}
