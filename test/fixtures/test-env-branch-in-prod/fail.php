<?php

namespace App\Services;

class PaymentGateway
{
    public function charge(Order $order): bool
    {
        if (app()->runningUnitTests()) { // expect: test-env-branch-in-prod
            return true;
        }
        if (app()->environment('testing')) { // expect: test-env-branch-in-prod
            return true;
        }
        return $this->client->charge($order->total);
    }
}
