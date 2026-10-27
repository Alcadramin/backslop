<?php

final class OrderService
{
    public function processOrder(Order $order): void
    {
        $order->markPaid();
        $this->mailer->receipt($order);
    }

    public function processOrderV2(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $order->markPaid();
        });
        $this->mailer->receipt($order);
    }
}
