<?php
class RefundOrder
{
    public function handle(StripeClient $stripe, Order $order): void
    {
        $stripe->refunds->create(['payment_intent' => $order->payment_intent_id]); // expect: outbound-payment-no-idempotency-key
        $stripe->transfers->create(['amount' => 500, 'destination' => $order->seller_account], ['idempotency_key' => (string) Str::uuid()]); // expect: outbound-payment-no-idempotency-key
    }
}
