<?php
namespace App\Services;

use App\Models\Price;
use App\Models\Order;

class PriceImport
{
    public function run(array $rows, $stale)
    {
        foreach ($rows as $r) {
            Price::updateOrCreate(['sku' => $r['sku']], ['amount' => $r['amount']]); // expect: row-by-row-writes
        }
        foreach ($stale as $order) {
            $order->archived = true;
            $order->save(); // expect: row-by-row-writes
        }
        foreach ($rows as $r) {
            DB::table('prices')->insert($r); // expect: row-by-row-writes
        }
    }
}
