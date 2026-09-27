<?php
function keep(array $orders, array $bannedIds): array
{
    $out = [];
    foreach ($orders as $o) {
        if (in_array($o['user_id'], $bannedIds, true)) {
            continue;
        }
        $out[] = $o + ['seen' => true];
    }
    return $out;
}
