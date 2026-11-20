<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Support\Money;
use Illuminate\Console\Command;

class NormalizeOrderCurrency extends Command
{
    protected $signature = 'orders:normalize-currency';

    protected $description = 'Backfill amount_eur_cents for orders imported from the legacy shop';

    public function handle(): int
    {
        $updated = 0;

        // chunkById pages by id, so rows that leave the whereNull filter don't shift later pages
        Order::whereNull('amount_eur_cents')
            ->chunkById(500, function ($orders) use (&$updated) {
                $rows = $orders->map(fn (Order $order) => [
                    'id' => $order->id,
                    'amount_eur_cents' => Money::toEurCents($order->amount_cents, $order->currency, $order->placed_at),
                ])->all();

                Order::upsert($rows, ['id'], ['amount_eur_cents']);
                $updated += count($rows);
            });

        $this->info("Normalized {$updated} orders.");

        return self::SUCCESS;
    }
}
