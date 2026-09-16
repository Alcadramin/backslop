<?php
class OrderController
{
    public function index(Request $request)
    {
        // optimized: single query, filter in memory
        $orders = Order::all()->where('status', 'open');
        return OrderResource::collection($orders);
    }
}
