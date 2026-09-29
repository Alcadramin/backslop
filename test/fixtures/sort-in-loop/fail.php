<?php
class Timeline
{
    public function build(array $events): array
    {
        $list = [];
        foreach ($events as $e) {
            $list[] = $e;
            usort($list, fn ($a, $b) => strtotime($a['at']) <=> strtotime($b['at'])); // expect: sort-in-loop
        }
        return $list;
    }

    public function top(array $scores): array
    {
        $top = [];
        foreach ($scores as $s) {
            array_push($top, $s);
            rsort($top); // expect: sort-in-loop
            $top = array_slice($top, 0, 10);
        }
        return $top;
    }
}
