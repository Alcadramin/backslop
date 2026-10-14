<?php
class ReserveStock
{
    public function handle(int $id, int $qty): void
    {
        DB::transaction(function () use ($id, $qty) {
            $p = Product::findOrFail($id);
            if ($p->stock < $qty) {
                throw new OutOfStock();
            }
            $p->stock = $p->stock - $qty;
            $p->save();
        });
    }
}
