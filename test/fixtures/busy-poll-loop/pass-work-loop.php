<?php
class WriteImportBatch
{
    public function handle(): void
    {
        // Each pass does real work; the status check only decides whether to keep going.
        do {
            $this->writeWhileLocked();
        } while ($this->job instanceof SyncJob && $this->import->refresh()->status === ImportStatus::Writing);
    }
}
