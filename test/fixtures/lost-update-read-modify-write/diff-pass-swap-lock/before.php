<?php
class ReserveStock
{
    public function handle(int $id, int $qty): void
    {
        DB::transaction(function () use ($id, $qty) {
            $p = Product::whereKey($id)->lockForUpdate()->firstOrFail();
            $p->decrement('stock', $qty);
        });
    }
}
