<?php
namespace App\Jobs;

class SyncToErp implements ShouldQueue
{
    use Queueable;

    public $tries = 50; // expect: job-timeout-retry-mismatch
    public $timeout = 120;

    public function handle(): void
    {
        Http::timeout(10)->post(config('services.erp.url'), $this->payload);
    }
}
