<?php
class Totals
{
    public function sum(array $prices): float
    {
        $total = 0;
        foreach (array_keys($prices) as $sku) { // expect: iterate-keys-then-index
            $total += $prices[$sku];
        }
        return $total;
    }

    public function labels(): array
    {
        $out = [];
        foreach (array_keys($this->items) as $key) { // expect: iterate-keys-then-index
            $out[] = $key . ': ' . $this->items[$key]['label'];
        }
        return $out;
    }
}
