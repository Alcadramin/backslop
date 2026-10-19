<?php
class SyncOrder
{
    public function handle(Order $order): void
    {
        Http::post('https://erp.example.com/orders', $order->toArray());
    }
}
