<?php

class ReportService
{
    public function overdue()
    {
        return $this->unpaid()->where('due_at', '<', now())->orderBy('id')->cursorPaginate(50);
    }

    public function export(callable $write)
    {
        $this->unpaid()->orderBy('id')->lazyById(500)->each(fn ($invoice) => $write($invoice->toArray()));
    }

    private function unpaid()
    {
        return Invoice::where('paid', false);
    }
}
