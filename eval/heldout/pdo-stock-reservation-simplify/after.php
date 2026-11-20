<?php

namespace App\Inventory;

use PDO;

final class StockReservations
{
    public function __construct(private PDO $pdo) {}

    public function reserve(string $sku, int $warehouseId, int $qty, string $orderRef): void
    {
        $onHand = (int) $this->pdo
            ->query("SELECT on_hand FROM stock_levels WHERE sku = '{$sku}' AND warehouse_id = {$warehouseId}")
            ->fetchColumn();

        if ($onHand < $qty) {
            throw new InsufficientStock($sku, $onHand, $qty);
        }

        $this->pdo->prepare('UPDATE stock_levels SET on_hand = ? WHERE sku = ? AND warehouse_id = ?')
            ->execute([$onHand - $qty, $sku, $warehouseId]);

        $this->pdo->prepare('INSERT INTO reservations (sku, warehouse_id, qty, order_ref) VALUES (?, ?, ?, ?)')
            ->execute([$sku, $warehouseId, $qty, $orderRef]);
    }
}
