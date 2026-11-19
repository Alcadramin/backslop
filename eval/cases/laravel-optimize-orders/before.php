<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $orders = Order::with('customer')
            ->where('status', $request->input('status', 'open'))
            ->orderBy('id')
            ->paginate(50);

        return OrderResource::collection($orders);
    }

    public function stats()
    {
        return [
            'open' => Order::where('status', 'open')->count(),
            'revenue' => Order::where('status', 'paid')->sum('total'),
        ];
    }
}
