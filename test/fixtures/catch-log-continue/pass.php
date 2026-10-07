<?php
class Jobs
{
    // Per-item handler in a batch: the failure is recorded and the batch keeps going.
    public function importAll(array $rows): void
    {
        foreach ($rows as $row) {
            try {
                $this->importer->import($row);
            } catch (\Throwable $e) {
                Log::error('row failed', ['row' => $row['id'], 'exception' => $e]);
            }
        }
        collect($rows)->each(function (array $row): void {
            try {
                $this->importer->import($row);
            } catch (\Throwable $e) {
                report($e);
            }
        });
    }

    // Best-effort side effect; nothing claims success afterwards.
    public function notify(User $user): void
    {
        try {
            Mail::to($user)->queue(new Welcome());
        } catch (\Throwable $e) {
            report($e);
        }
    }

    // Logs and rethrows.
    public function charge(Order $order): bool
    {
        try {
            $this->gateway->charge($order);
        } catch (\Throwable $e) {
            Log::error('charge failed', ['exception' => $e]);
            throw $e;
        }
        return true;
    }

    // Narrow, expected failure with a reason.
    public function ping(): bool
    {
        try {
            $this->http->get('/health');
        } catch (\Throwable $e) {
            // health pings are advisory; the monitor alerts on its own
            Log::info('ping failed');
        }
        return true;
    }
}
