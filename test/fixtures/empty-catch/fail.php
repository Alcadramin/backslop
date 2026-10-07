<?php
class InvoiceSync
{
    public function run(array $invoices): void
    {
        try { $this->api->push($invoices); } catch (\Throwable $e) {} // expect: empty-catch

        try {
            $this->ledger->post($invoices);
        } catch (Exception $e) { // expect: empty-catch
        }

        try { $this->mailer->send($invoices); } catch (\Exception) {} // expect: empty-catch
    }
}
