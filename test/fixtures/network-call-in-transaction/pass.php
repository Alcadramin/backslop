<?php
class PayOrder
{
    public function handle(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $order->update(['status' => 'paid']);
            SyncOrderToErp::dispatch($order)->afterCommit();
            Mail::to($order->user)->queue((new Receipt($order))->afterCommit());
            $this->notify('saved'); // Livewire UI toast, not a notification
            // Http::post('https://erp.example.com/orders', $order->toArray());
            $log = 'Http::post(';
        });

        // after the commit: fine
        Http::post('https://erp.example.com/orders', $order->toArray());
        Mail::to($order->user)->send(new Receipt($order));
        $order->user->notify(new OrderPaid($order));
    }

    public function manual(Order $order): void
    {
        DB::beginTransaction();
        $order->update(['status' => 'shipped']);
        DB::commit();
        Http::post('https://carrier.example.com/labels', []);
    }
}

class OrderTest
{
    public function setUp(): void
    {
        Http::fake();
    }
}
