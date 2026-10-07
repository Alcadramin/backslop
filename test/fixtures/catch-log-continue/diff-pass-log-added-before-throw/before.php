<?php
function charge($gateway, $order) {
    try {
        $gateway->charge($order);
    } catch (PaymentDeclined $e) {
        throw new OrderNotPaid($order->id, 0, $e);
    }
}
