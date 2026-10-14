<?php
class ReserveStock
{
    public function handle(int $id, int $qty): void
    {
        // Product::whereKey($id)->lockForUpdate() used to be here
        Product::whereKey($id)->where('stock', '>=', $qty)->decrement('stock', $qty);
    }
}
