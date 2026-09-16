<?php
class OrderController
{
    public function index(Request $request)
    {
        $orders = Order::where('status', 'open')->orderBy('id')->paginate(50);
        return OrderResource::collection($orders);
    }
}
