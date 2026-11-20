<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderCancellationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_cancel_unshipped_order(): void
    {
        $user = User::factory()->create();
        $order = Order::factory()->for($user)->create(['status' => 'paid']);

        $response = $this->actingAs($user)->postJson("/api/orders/{$order->id}/cancel");

        $response->assertOk();
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'cancelled']);
        $this->assertSame(1, $order->refunds()->count());
    }

    public function test_customer_cannot_cancel_someone_elses_order(): void
    {
        $order = Order::factory()->create(['status' => 'paid']);

        $response = $this->actingAs(User::factory()->create())
            ->postJson("/api/orders/{$order->id}/cancel");

        $response->assertStatus(403);
    }

    public function test_shipped_order_cannot_be_cancelled(): void
    {
        $user = User::factory()->create();
        $order = Order::factory()->for($user)->create(['status' => 'shipped']);

        $response = $this->actingAs($user)->postJson("/api/orders/{$order->id}/cancel");

        $response->assertStatus(422);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'shipped']);
    }
}
