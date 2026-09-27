<?php
class Honest
{
    private const STATUSES = ['open', 'paid', 'shipped'];
    private array $kinds = ['a', 'b', 'c'];

    public function run(array $orders, array $bannedIds, array $users): array
    {
        $out = [];
        // opcache compiles in_array against a literal array to ZEND_IN_ARRAY: a hash lookup
        foreach ($orders as $o) {
            if (in_array($o['status'], ['open', 'paid'], true)) {
                $out[] = $o;
            }
            if (in_array($o['status'], self::STATUSES, true)) {
                $out[] = $o;
            }
            if (in_array($o['kind'], $this->kinds, true)) {
                $out[] = $o;
            }
            // the haystack belongs to the current item: no cross product
            if (in_array('gift', $o['tags'], true)) {
                $out[] = $o;
            }
            $allowed = ['x', 'y'];
            if (in_array($o['flag'], $allowed, true)) {
                $out[] = $o;
            }
        }

        // the keyed version
        $banned = array_flip($bannedIds);
        foreach ($orders as $o) {
            if (isset($banned[$o['user_id']])) {
                continue;
            }
        }

        // not in a loop
        $isBanned = in_array($users[0]['id'], $bannedIds, true);

        // a closure defined in a loop body is not necessarily called per iteration... but this one is
        // outside any loop entirely
        $check = function ($id) use ($bannedIds) {
            return in_array($id, $bannedIds, true);
        };

        // per-item list rebuilt every iteration
        foreach ($users as $u) {
            $roles = $u->roles();
            if (in_array('admin', $roles, true)) {
                $out[] = $u;
            }
        }
        return $out;
    }
}
