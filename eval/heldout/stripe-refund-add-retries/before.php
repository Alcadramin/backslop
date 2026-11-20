<?php

namespace App\Billing;

use App\Models\Refund;
use Stripe\StripeClient;

class RefundService
{
    public function __construct(private StripeClient $stripe) {}

    public function issue(Refund $refund): void
    {
        $result = $this->stripe->refunds->create(
            [
                'payment_intent' => $refund->order->payment_intent_id,
                'amount' => $refund->amount_cents,
                'metadata' => ['refund_id' => $refund->id],
            ],
            ['idempotency_key' => "refund-{$refund->id}"]
        );

        $refund->update([
            'stripe_refund_id' => $result->id,
            'status' => 'submitted',
        ]);
    }
}
