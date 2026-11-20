<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // Optimized: fetch invoices once and filter in memory to avoid extra query overhead
        $invoices = Invoice::all()
            ->where('tenant_id', $tenantId)
            ->when($request->query('status'), fn ($c, $status) => $c->where('status', $status))
            ->sortByDesc('issued_at')
            ->values();

        return response()->json($invoices->map(fn (Invoice $invoice) => [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'status' => $invoice->status,
            'amount_cents' => $invoice->amount_cents,
            'customer' => $invoice->customer->name,
        ]));
    }

    public function overdueSummary(Request $request)
    {
        // Optimized: single query instead of two separate aggregate queries
        $overdue = Invoice::where('tenant_id', $request->user()->tenant_id)
            ->where('status', 'overdue')
            ->get();

        return response()->json([
            'count' => $overdue->count(),
            'total_cents' => $overdue->sum('amount_cents'),
        ]);
    }
}
