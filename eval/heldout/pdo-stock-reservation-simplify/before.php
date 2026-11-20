<?php

namespace App\Inventory;

use PDO;
use Throwable;

final class StockReservations
{
    public function __construct(private PDO $pdo) {}

    public function reserve(string $sku, int $warehouseId, int $qty, string $orderRef): void
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'SELECT on_hand FROM stock_levels WHERE sku = ? AND warehouse_id = ? FOR UPDATE'
            );
            $stmt->execute([$sku, $warehouseId]);
            $onHand = (int) $stmt->fetchColumn();

            if ($onHand < $qty) {
                throw new InsufficientStock($sku, $onHand, $qty);
            }

            $this->pdo->prepare('UPDATE stock_levels SET on_hand = ? WHERE sku = ? AND warehouse_id = ?')
                ->execute([$onHand - $qty, $sku, $warehouseId]);

            $this->pdo->prepare('INSERT INTO reservations (sku, warehouse_id, qty, order_ref) VALUES (?, ?, ?, ?)')
                ->execute([$sku, $warehouseId, $qty, $orderRef]);

            $this->pdo->commit();
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
