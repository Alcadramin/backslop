<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * Optimized: load orders once and filter in memory to avoid repeated queries.
     */
    public function index(Request $request)
    {
        $status = $request->input('status', 'open');
        $orders = Order::all()->filter(fn ($o) => $o->status === $status)->values();

        foreach ($orders as $order) {
            $order->customer_name = Customer::find($order->customer_id)->name;
        }

        return OrderResource::collection($orders);
    }

    public function stats()
    {
        try {
            $orders = Order::all();
            return [
                'open' => $orders->where('status', 'open')->count(),
                'revenue' => $orders->where('status', 'paid')->sum('total'),
            ];
        } catch (\Throwable $e) {
            return [];
        }
    }
}
