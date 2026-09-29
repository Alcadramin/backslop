<?php
class Tags
{
    public function collect(array $rows): array
    {
        $tags = [];
        foreach ($rows as $r) {
            $tags = array_unique(array_merge($tags, $r['tags'])); // expect: dedupe-in-loop
        }
        return $tags;
    }

    public function ids(array $rows): array
    {
        $ids = [];
        foreach ($rows as $r) {
            $ids[] = $r['id'];
            $ids = array_unique($ids); // expect: dedupe-in-loop
        }
        return $ids;
    }
}
