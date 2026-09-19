<?php
class InvoiceService
{
    public function totals(array $orderIds, $users)
    {
        $orders = Order::with('user')->whereIn('id', $orderIds)->get();   // one query, before the loop
        foreach ($orders as $order) {
            $name = $order->user->name;                                     // eager loaded
            $total = $order->lines->sum('amount');                          // collection, already loaded
            $keys = $order->values()->first();                              // collection method, not a relation
        }
        foreach (['draft', 'sent', 'paid'] as $status) {                   // three fixed statuses
            $counts[$status] = Order::where('status', $status)->count();
        }
        foreach (array_chunk($orderIds, 1000) as $chunk) {                 // batching is the fix
            $rows[] = Order::whereIn('id', $chunk)->get();
        }
        while ($ids !== []) {                                               // tree walk, one query per level
            $ids = Folder::query()->whereIn('parent_id', $ids)->pluck('id')->all();
        }
        $names = array_map(fn ($u) => $u->name, User::where('active', true)->get()->all()); // query is the list argument
        foreach ($orders as $order) {
            $items = Arr::where($order->items, fn ($i) => $i > 0);           // Arr helper, not a model
            $handler = function () use ($order) { return Order::find($order->id); }; // closure defined, not run here
        }
        return [$names, $counts, $rows];
    }
}
