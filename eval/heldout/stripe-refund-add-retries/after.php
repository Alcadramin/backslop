<?php

namespace App\Billing;

use App\Models\Refund;
use Stripe\Exception\ApiConnectionException;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class RefundService
{
    private const MAX_ATTEMPTS = 5;

    public function __construct(private StripeClient $stripe) {}

    public function issue(Refund $refund): void
    {
        $attempt = 0;

        // Retry transient Stripe failures so refunds don't get stuck in pending
        while (true) {
            try {
                $result = $this->stripe->refunds->create([
                    'payment_intent' => $refund->order->payment_intent_id,
                    'amount' => $refund->amount_cents,
                    'metadata' => ['refund_id' => $refund->id],
                ]);
                break;
            } catch (ApiConnectionException | ApiErrorException $e) {
                if (++$attempt >= self::MAX_ATTEMPTS) {
                    throw $e;
                }
            }
        }

        $refund->update([
            'stripe_refund_id' => $result->id,
            'status' => 'submitted',
        ]);
    }
}
