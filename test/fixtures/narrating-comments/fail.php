<?php

final class InvoiceService
{
    public function send(int $id): void
    {
        // Get the invoice by id                                expect: narrating-comments
        $invoice = $this->invoices->find($id);

        // Loop through the lines                               expect: narrating-comments
        foreach ($invoice->lines as $line) {
            $this->tax->apply($line);
        }

        // Added null check to fix the crash on empty invoices   expect: narrating-comments
        if ($invoice->customer === null) {
            return;
        }
        // Send the invoice                                     expect: narrating-comments
        $this->mailer->send($invoice);
    }
}
