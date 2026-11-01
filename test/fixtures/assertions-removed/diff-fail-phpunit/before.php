<?php

namespace Tests\Feature;

use Tests\TestCase;

class OrderPolicyTest extends TestCase
{
    public function test_guest_cannot_cancel_order(): void
    {
        $order = Order::factory()->create();
        $response = $this->postJson("/api/orders/{$order->id}/cancel");
        $this->assertSame(401, $response->status());
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'open']);
    }
}
