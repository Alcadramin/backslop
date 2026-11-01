<?php

use Tests\TestCase;

class CheckoutTest extends TestCase
{
    public function test_checkout_creates_items(): void
    {
        $order = $this->checkout(['sku-1', 'sku-2', 'sku-3']);
        $this->assertNotNull($order->items());
    }
}
