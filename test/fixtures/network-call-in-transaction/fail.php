<?php
class PayOrder
{
    public function handle(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $order->update(['status' => 'paid']);
            Http::post('https://erp.example.com/orders', $order->toArray()); // expect: network-call-in-transaction
            Mail::to($order->user)->send(new Receipt($order)); // expect: network-call-in-transaction
            $order->user->notify(new OrderPaid($order)); // expect: network-call-in-transaction
            $this->stripe->refunds->create(['charge' => $order->charge_id]); // expect: network-call-in-transaction
        });
    }

    public function manual(Order $order): void
    {
        DB::beginTransaction();
        $order->update(['status' => 'shipped']);
        $res = Http::withToken($this->token)->post('https://carrier.example.com/labels', []); // expect: network-call-in-transaction
        DB::commit();
    }
}
