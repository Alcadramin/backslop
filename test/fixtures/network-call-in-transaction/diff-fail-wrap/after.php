<?php
class PayOrder
{
    public function handle(Order $order): void
    {
        DB::transaction(function () use ($order) {
        $order->update(['status' => 'paid']);
        Http::post('https://erp.example.com/orders', $order->toArray());
        });
    }
}
