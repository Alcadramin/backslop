<?php
class PaymentService
{
    public function capture(Order $order): void
    {
        try {
            $this->gateway->capture($order);
        } catch (PaymentFailed $e) {
            throw $e;
        }
        $order->markPaid();
    }
}
