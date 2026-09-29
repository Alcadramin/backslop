<?php
class Honest
{
    public function build(array $events, array $groups): array
    {
        $list = [];
        foreach ($events as $e) {
            $e['ts'] = strtotime($e['at']);
            $list[] = $e;
        }
        usort($list, fn ($a, $b) => $a['ts'] <=> $b['ts']);

        // each group sorts its own small list: independent sorts
        foreach ($groups as &$g) {
            sort($g['items']);
        }
        foreach ($groups as $name => $items) {
            sort($items);
            $groups[$name] = $items;
        }

        // a fresh list per iteration
        foreach ($groups as $g) {
            $names = [];
            foreach ($g['members'] as $m) {
                $names[] = $m['name'];
            }
            sort($names);
        }
        return [$list, $groups];
    }
}
