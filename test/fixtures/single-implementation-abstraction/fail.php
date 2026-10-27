<?php

namespace App\Pricing;

interface PriceCalculatorInterface // expect: single-implementation-abstraction
{
    public function total(Cart $cart): Money;
}

final class PriceCalculator implements PriceCalculatorInterface
{
    public function total(Cart $cart): Money
    {
        return $cart->lines()->sum(fn ($l) => $l->price * $l->qty);
    }
}
