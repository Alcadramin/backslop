<?php
class TransferFunds
{
    public function handle(Account $from, Account $to, int $amt): void
    {
        $this->db->transaction(function () use ($from, $to, $amt) {
            $from->decrement('balance', $amt);
            $to->increment('balance', $amt);
        }, attempts: 3);
    }
}
