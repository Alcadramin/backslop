<?php
namespace App\Jobs;

class SyncToErp implements ShouldQueue
{
    use Queueable;

    public $tries = 25;
    public $timeout = 120;

    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(): void
    {
        Http::timeout(10)->post(config('services.erp.url'), $this->payload);
    }
}

class SmallJob implements ShouldQueue
{
    public $tries = 3;
}
