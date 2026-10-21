<?php
class RefundOrder
{
    public function handle(StripeClient $stripe, Order $order): void
    {
        $stripe->refunds->create(
            ['payment_intent' => $order->payment_intent_id],
            ['idempotency_key' => "order-{$order->id}-refund"],
        );
        $stripe->customers->create(['email' => $order->email]);
    }
}
