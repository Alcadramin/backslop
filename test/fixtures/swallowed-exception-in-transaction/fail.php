<?php
class Checkout
{
    public function place(Cart $cart): Order
    {
        return DB::transaction(function () use ($cart) {
            $order = Order::create(['user_id' => $cart->user_id]);
            try {
                foreach ($cart->items as $i) {
                    $order->items()->create($i);
                }
            } catch (\Throwable $e) { // expect: swallowed-exception-in-transaction
                Log::error($e);
            }
            try {
                $cart->coupon->increment('uses');
            } catch (QueryException $e) { // expect: swallowed-exception-in-transaction
                report($e);
                return $order;
            }
            return $order;
        });
    }
}
