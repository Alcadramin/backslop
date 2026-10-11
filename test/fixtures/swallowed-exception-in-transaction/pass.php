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
                throw $e;
            }
            try {
                $order->update(['meta' => json_decode($cart->meta, flags: JSON_THROW_ON_ERROR)]);
            } catch (JsonException $e) {
                // not a database error: the row is fine, the input was bad
                $order->meta = null;
            }
            try {
                DB::transaction(fn () => $order->tags()->attach($cart->tags)); // savepoint
            } catch (QueryException $e) {
                Log::warning('tags skipped');
            }
            return $order;
        });
    }

    public function outside(Order $order): void
    {
        try {
            DB::transaction(fn () => $order->save());
        } catch (\Throwable $e) {
            Log::error($e);
        }
    }
}
