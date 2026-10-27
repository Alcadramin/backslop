<?php

final class OrderService
{
    public function processOrder(Order $order): void
    {
        $order->markPaid();
        $this->mailer->receipt($order);
    }
}
