<?php
class CheckoutService
{
    public function settle(Order $order): bool
    {
        try {
            $this->gateway->charge($order);
        } catch (\Throwable $e) { // expect: catch-log-continue
            Log::error($e->getMessage());
        }
        $order->markPaid();
        return true;
    }

    public function refund(Order $order): array
    {
        try { $this->gateway->refund($order); } catch (\Exception $e) { $this->logger->error('refund failed', ['exception' => $e]); } // expect: catch-log-continue
        return ['ok' => true];
    }
}
