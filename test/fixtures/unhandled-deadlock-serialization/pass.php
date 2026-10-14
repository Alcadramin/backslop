<?php
class BookSeat
{
    public function handle(int $seatId): void
    {
        DB::transaction(function () use ($seatId) {
            DB::statement('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
            Seat::whereKey($seatId)->update(['taken' => true]);
        });
    }
}
