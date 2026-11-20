<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $invoices = Invoice::query()
            ->with('customer:id,name')
            ->where('tenant_id', $tenantId)
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->cursorPaginate(25);

        return $invoices->through(fn (Invoice $invoice) => [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'status' => $invoice->status,
            'amount_cents' => $invoice->amount_cents,
            'customer' => $invoice->customer->name,
        ]);
    }

    public function overdueSummary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        return response()->json([
            'count' => Invoice::where('tenant_id', $tenantId)->where('status', 'overdue')->count(),
            'total_cents' => Invoice::where('tenant_id', $tenantId)->where('status', 'overdue')->sum('amount_cents'),
        ]);
    }
}
