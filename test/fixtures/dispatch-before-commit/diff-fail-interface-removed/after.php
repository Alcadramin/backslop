<?php
class OrderPlaced
{
    use Dispatchable;

    public function __construct(public Order $order) {}
}
