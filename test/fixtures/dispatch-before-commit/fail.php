<?php
class PlaceOrder
{
    public function __invoke(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $order = Order::create($data);
            ProcessOrder::dispatch($order); // expect: dispatch-before-commit
            dispatch(new SendInvoice($order)); // expect: dispatch-before-commit
            Mail::to($order->user)->queue(new OrderPlacedMail($order)); // expect: dispatch-before-commit
            Bus::chain([new ReserveStock($order), new ChargeCard($order)])->dispatch(); // expect: dispatch-before-commit
            return $order;
        });
    }
}
