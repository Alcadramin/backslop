<?php
class Checkout
{
    public function place(Cart $cart): Order
    {
        return DB::transaction(function () use ($cart) {
            $order = Order::create(['user_id' => $cart->user_id]);
            try {
                $order->items()->createMany($cart->items);
            } catch (\Throwable $e) {
                Log::error($e);
            }
            return $order;
        });
    }
}
