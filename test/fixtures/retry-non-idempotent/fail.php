<?php
class ChargeCard
{
    public function handle(Order $order): void
    {
        Http::timeout(5)->retry(3, 300)->post('https://pay.example.com/charges', $order->charge()); // expect: retry-non-idempotent
    }
}
