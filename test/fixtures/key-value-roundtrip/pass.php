<?php
class Honest
{
    public function run(array $byId, array $rows, array $tags, array $users): array
    {
        // array_filter keeps keys; array_values is needed for a JSON list
        $active = array_values(array_filter($rows, fn ($r) => $r['active']));
        // array_map keeps string keys too
        $mapped = array_values(array_map(fn ($r) => $r['id'] * 2, $rows));
        // dedupe rows by id (last wins), then back to a list: deliberate
        $deduped = array_values(array_column($rows, null, 'id'));
        // count the values equal to 'x': the search form of array_keys
        $xs = count(array_keys($tags, 'x', true));
        // combining two different arrays
        $labels = array_combine(array_keys($byId), array_column($rows, 'label'));
        // method call, not a plain key pluck (array_column can't do this)
        $names = array_map(fn ($u) => $u->getName(), $users);
        // pluck plus transform: not array_column
        $upper = array_map(fn ($r) => strtoupper($r['name']), $rows);
        // array_map over two arrays
        $zip = array_map(fn ($a) => $a['id'], $rows, $users);
        // the idiomatic forms
        $ids = array_keys($byId);
        $emails = array_column($rows, 'email');
        $byKey = array_column($rows, null, 'id');
        return compact('active', 'mapped', 'deduped', 'xs', 'labels', 'names', 'upper', 'zip', 'ids', 'emails', 'byKey');
    }
}
