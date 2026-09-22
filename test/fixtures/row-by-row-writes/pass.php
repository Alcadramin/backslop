<?php
namespace App\Services;

use App\Models\Price;
use App\Exceptions\ImportFailed;

class PriceImport
{
    public function run(array $rows, $items)
    {
        Price::upsert($rows, uniqueBy: ['sku'], update: ['amount']);
        Order::where('status', 'stale')->update(['archived' => true]);
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('prices')->insert($chunk);                    // one insert per batch
        }
        $items->each(function (Item $item, int $index) {
            $item->position = $index;                               // reorder: each row gets its own value
            $item->save();
        });
        foreach ($rows as $r) {
            $errors[] = ImportFailed::create($r['sku']);            // exception factory, not a model
        }
        while ($attempts++ < 3) {
            if ($this->client->save()) { break; }                    // retry loop
        }
    }
}
