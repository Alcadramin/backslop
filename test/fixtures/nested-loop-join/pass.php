<?php
class Honest
{
    public function indexed(array $userIds): array
    {
        $users = User::whereIn('id', $userIds)->get()->toArray();
        $orders = Order::whereIn('user_id', $userIds)->get()->toArray();

        // hash join: index once, look up by key
        $byUser = [];
        foreach ($orders as $o) {
            $byUser[$o['user_id']][] = $o;
        }
        foreach ($users as &$u) {
            $u['orders'] = $byUser[$u['id']] ?? [];
        }

        // the inner collection belongs to the outer item: no cross product
        foreach ($users as $user) {
            foreach ($user['addresses'] as $address) {
                if ($address['id'] === $user['default_address_id']) {
                    $user['default'] = $address;
                }
            }
        }

        // the comparison doesn't involve the outer item (that's loop-invariant work, not a join)
        foreach ($users as $user) {
            $admins = array_filter($orders, fn ($o) => $o['status'] === 'refunded');
        }
        return $users;
    }

    public function smallList(array $fields, array $columns): array
    {
        // a small in-memory list passed in: not a query result, left to review
        $out = [];
        foreach ($fields as $f) {
            foreach ($columns as $c) {
                if ($c['name'] === $f['name']) {
                    $out[] = $c;
                }
            }
        }
        return $out;
    }
}
