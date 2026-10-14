<?php
class TransferFunds
{
    public function handle(Account $from, Account $to, int $amt): void
    {
        $from->decrement('balance', $amt);
        $to->increment('balance', $amt);
        Transfer::create(['from_id' => $from->id, 'to_id' => $to->id, 'amount' => $amt]);
    }
}
