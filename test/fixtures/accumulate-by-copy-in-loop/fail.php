<?php
class Sync
{
    private array $seen = [];

    public function pull($api, array $pages): array
    {
        $rows = [];
        foreach ($pages as $p) {
            $rows = array_merge($rows, $api->fetch($p)); // expect: accumulate-by-copy-in-loop
        }
        return $rows;
    }

    public function spread(array $offers): array
    {
        $currencies = [];
        foreach ($offers as $offer) {
            $currencies = [...$currencies, ...array_keys($offer['prices'])]; // expect: accumulate-by-copy-in-loop
        }
        return $currencies;
    }

    public function property(array $batches): void
    {
        foreach ($batches as $b) {
            $this->seen = array_merge($this->seen, $b); // expect: accumulate-by-copy-in-loop
        }
    }

    public function prepend(array $pages, $api): array
    {
        $all = [];
        $page = 1;
        while ($page <= count($pages)) {
            $all = array_merge($api->fetch($page), $all); // expect: accumulate-by-copy-in-loop
            $page++;
        }
        return $all;
    }

    public function reduce(array $rows): array
    {
        return array_reduce($rows, fn ($carry, $r) => array_merge($carry, [$r['id'] => $r]), []); // expect: accumulate-by-copy-in-loop
    }
}
