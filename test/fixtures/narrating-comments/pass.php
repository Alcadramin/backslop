<?php

final class InvoiceService
{
    public function send(int $id): void
    {
        // find() bypasses the soft-delete scope on purpose: support staff can view deleted invoices.
        $invoice = $this->invoices->find($id);

        // Cents, not euros: the PSP rejects decimals.
        $amount = $invoice->total * 100;

        // Validate the request
        $data = $this->validate([
            'email' => 'required|email',
        ]);

        // Create the invoice lines
        $this->lines->createFor($invoice);
        $this->audit->record($invoice);

        // Check permissions
        $this->authorize('send', $invoice);

        // Removed users stay in the table for 30 days so refunds still resolve.
        $user = $invoice->user;

        // Updated hourly by the cron job, see app/Console/Kernel.php.
        $rate = $this->rates->current();

        # Get the user
        #[Pure]
        $x = 1;
    }
}
