<?php

final class OrderPresenter
{
    public function toPayload(Order $order): array
    {
        $data = json_decode(json_encode($order), true); // expect: needless-type-roundtrip
        $data['total'] = $order->total();
        return $data;
    }

    public function items(object $cart): array
    {
        return json_decode( json_encode($cart->items) , true ); // expect: needless-type-roundtrip
    }
}
