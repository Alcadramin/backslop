<?php
class Honest
{
    public function run(array $prices, array $cache): array
    {
        $total = 0;
        foreach ($prices as $sku => $price) {
            $total += $price;
        }

        // removing entries while iterating: a snapshot of the keys is the right tool
        foreach (array_keys($cache) as $key) {
            if ($cache[$key]['expired']) {
                unset($cache[$key]);
            }
        }

        // writing back through the key
        foreach (array_keys($prices) as $sku) {
            $prices[$sku] = round($prices[$sku], 2);
        }

        // only the keys are used
        foreach (array_keys($prices) as $sku) {
            echo $sku;
        }
        return [$total, $cache, $prices];
    }
}
