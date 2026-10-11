<?php
class PlaceOrder
{
    public function __invoke(array $data): Order
    {
        $order = DB::transaction(function () use ($data) {
            $order = Order::create($data);
            ProcessOrder::dispatch($order)->afterCommit();
            SendInvoice::dispatchSync($order);
            ProcessOrder::dispatch($order)->onConnection('sync');
            $this->dispatch('order-created'); // Livewire browser event
            event(new OrderCreated($order)); // sync listeners run in the transaction: review, not flagged
            return $order;
        });

        // after commit, like monica's LogUserAction::dispatch(...) after DB::transaction
        LogUserAction::dispatch(account: $order->account, action: 'created')->onQueue('low');
        return $order;
    }

    public function dispatch($job)
    {
        return app(Dispatcher::class)->dispatch($job);
    }
}
