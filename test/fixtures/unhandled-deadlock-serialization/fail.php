<?php
class BookSeat
{
    public function handle(int $seatId): void
    {
        DB::transaction(function () use ($seatId) {
            DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'); // expect: unhandled-deadlock-serialization
            Seat::whereKey($seatId)->update(['taken' => true]);
        });
    }
}
