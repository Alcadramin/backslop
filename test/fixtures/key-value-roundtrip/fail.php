<?php
class Roundtrips
{
    public function run(array $byId, array $rows, array $tags, string $csv): array
    {
        $ids = array_values(array_keys($byId)); // expect: key-value-roundtrip
        $same = array_combine(array_keys($byId), array_values($byId)); // expect: key-value-roundtrip
        $also = array_combine(array_keys($this->map), $this->map); // expect: key-value-roundtrip
        $emails = array_map(fn ($r) => $r['email'], $rows); // expect: key-value-roundtrip
        $names = array_map(function (array $r) { return $r['name']; }, $rows); // expect: key-value-roundtrip
        $keyed = array_combine(array_column($rows, 'id'), $rows); // expect: key-value-roundtrip
        $pairs = array_combine(array_column($rows, 'id'), array_column($rows, 'name')); // expect: key-value-roundtrip
        $unique = array_flip(array_flip($tags)); // expect: key-value-roundtrip
        $parts = array_values(explode(',', $csv)); // expect: key-value-roundtrip
        $col = array_values(array_column($rows, 'id')); // expect: key-value-roundtrip
        $has = in_array('x', array_values($tags), true); // expect: key-value-roundtrip
        $n = count(array_keys($byId)); // expect: key-value-roundtrip
        $k = array_unique(array_keys($byId)); // expect: key-value-roundtrip
        return compact('ids', 'same', 'also', 'emails', 'names', 'keyed', 'pairs', 'unique', 'parts', 'col', 'has', 'n', 'k');
    }
}
