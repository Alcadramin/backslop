<?php
class SyncOrder
{
    public function handle(Order $order): void
    {
        Http::timeout(3)
            ->post('https://erp.example.com/orders', $order->toArray());
    }
}
