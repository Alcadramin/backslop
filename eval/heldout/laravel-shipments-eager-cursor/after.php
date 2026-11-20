<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Illuminate\Http\Request;

class ShipmentController extends Controller
{
    public function index(Request $request)
    {
        $shipments = Shipment::query()
            ->with(['carrier:id,name', 'destination:id,city'])
            ->where('account_id', $request->user()->account_id)
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('id')
            ->cursorPaginate(50);

        return $shipments->through(fn (Shipment $s) => [
            'id' => $s->id,
            'tracking' => $s->tracking_number,
            'status' => $s->status,
            'carrier' => $s->carrier->name,
            'destination' => $s->destination->city,
        ]);
    }
}
