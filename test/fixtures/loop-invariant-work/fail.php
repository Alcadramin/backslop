<?php
class Export
{
    public function rows(array $rows, array $bannedIds, string $mapPath): array
    {
        $out = [];
        foreach ($rows as $r) {
            $map = json_decode(file_get_contents(__DIR__ . '/map.json'), true); // expect: loop-invariant-work
            $banned = array_flip($bannedIds); // expect: loop-invariant-work
            $codes = file($mapPath); // expect: loop-invariant-work
            if (isset($banned[$r['user_id']])) {
                continue;
            }
            $out[] = [$map[$r['code']] ?? null, $codes];
        }
        return $out;
    }

    public function names(array $orders, array $users): array
    {
        return array_map(fn ($o) => array_column($users, 'name', 'id')[$o['user_id']] ?? null, $orders); // expect: loop-invariant-work
    }
}
