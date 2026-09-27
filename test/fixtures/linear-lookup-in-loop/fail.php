<?php
class OrderFilter
{
    private array $bannedIds;

    public function __construct(array $bannedIds)
    {
        $this->bannedIds = $bannedIds;
    }

    public function keep(array $orders, array $vipIds): array
    {
        $out = [];
        foreach ($orders as $o) {
            if (in_array($o['user_id'], $this->bannedIds, true)) { // expect: linear-lookup-in-loop
                continue;
            }
            $o['vip'] = array_search($o['user_id'], $vipIds) !== false; // expect: linear-lookup-in-loop
            $out[] = $o;
        }
        return $out;
    }

    public function flagged(array $rows, array $ids): array
    {
        return array_filter($rows, fn ($r) => in_array($r['id'], $ids, true)); // expect: linear-lookup-in-loop
    }

    public function names(array $rows, array $byName): array
    {
        $seen = [];
        foreach ($rows as $r) {
            // manual dedupe: the haystack grows, so this is O(n^2)
            if (!in_array($r['name'], $seen, true)) { // expect: linear-lookup-in-loop
                $seen[] = $r['name'];
            }
        }
        return $seen;
    }

    public function laravel($songs, $playlistSongIds)
    {
        return $songs->filter(fn ($s) => $playlistSongIds->contains($s->id)); // expect: linear-lookup-in-loop
    }

    public function inKeys(array $rows, array $map): array
    {
        $out = [];
        foreach ($rows as $r) {
            if (in_array($r['code'], array_keys($map), true)) { // expect: linear-lookup-in-loop
                $out[] = $r;
            }
        }
        return $out;
    }
}
