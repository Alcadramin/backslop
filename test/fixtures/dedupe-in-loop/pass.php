<?php
class Honest
{
    public function collect(array $rows): array
    {
        $seen = [];
        foreach ($rows as $r) {
            foreach ($r['tags'] as $t) {
                $seen[$t] = true;
            }
        }
        $tags = array_keys($seen);

        // per-item dedupe of a list that doesn't grow across iterations
        foreach ($rows as $r) {
            $own = array_unique($r['tags']);
            $r['tags'] = array_unique($r['tags']);
        }

        // once, after the loop
        $all = [];
        foreach ($rows as $r) {
            $all[] = $r['id'];
        }
        $all = array_unique($all);
        return [$tags, $all];
    }
}
