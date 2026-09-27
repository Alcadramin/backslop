<?php
class Honest
{
    public function pull($api, array $pages, array $defaults, array $override): array
    {
        $chunks = [];
        foreach ($pages as $p) {
            $chunks[] = $api->fetch($p);
        }
        $rows = array_merge(...$chunks);

        $all = [];
        foreach ($pages as $p) {
            foreach ($api->fetch($p) as $row) {
                $all[] = $row;
            }
        }

        // not in a loop
        $config = array_merge($defaults, $override);

        // flushed in batches: the copy never grows past the batch size
        $batch = [];
        foreach ($pages as $p) {
            $batch = array_merge($batch, $api->fetch($p));
            if (count($batch) >= 500) {
                $api->write($batch);
                $batch = [];
            }
        }

        // merging into a different array each time
        foreach ($pages as $p) {
            $merged = array_merge($defaults, $p);
        }

        // reduce that mutates its accumulator: linear
        $byId = array_reduce($rows, function ($carry, $r) {
            $carry[$r['id']] = $r;
            return $carry;
        }, []);

        return [$rows, $all, $config, $merged, $byId];
    }
}
