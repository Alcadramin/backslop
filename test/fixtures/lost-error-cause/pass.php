<?php
class OrderRepository
{
    public function save(Order $order): void
    {
        try {
            $this->db->insert('orders', $order->toArray());
        } catch (PDOException $e) {
            throw new RepositoryException("Saving order {$order->id} failed", 0, $e);
        }
        try {
            $this->db->insert('order_items', $order->items());
        } catch (PDOException $e) {
            Log::error('items failed', ['exception' => $e]);
            throw new RepositoryException('Saving items failed');
        }
        try {
            $found = $this->db->find($order->id);
        } catch (ModelNotFoundException $e) {
            throw new NotFoundHttpException();
        }
        try {
            $data = json_decode($order->payload, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new InvalidPayload('payload is not valid JSON');
        }
    }
}
