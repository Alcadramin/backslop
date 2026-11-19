<?php

class ReportService
{
    public function overdue()
    {
        return Invoice::where('due_at', '<', now())->where('paid', false)->orderBy('id')->paginate(50);
    }

    public function export(callable $write)
    {
        Invoice::where('paid', false)->orderBy('id')->chunkById(500, function ($invoices) use ($write) {
            foreach ($invoices as $invoice) {
                $write($invoice->toArray());
            }
        });
    }
}
