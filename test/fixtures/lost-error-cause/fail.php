<?php
class OrderRepository
{
    public function save(Order $order): void
    {
        try {
            $this->db->insert('orders', $order->toArray());
        } catch (PDOException $e) {
            throw new RepositoryException('Save failed'); // expect: lost-error-cause
        }
        try {
            $this->db->insert('order_items', $order->items());
        } catch (PDOException) {
            throw new RepositoryException('Saving items failed'); // expect: lost-error-cause
        }
    }
}
