<?php
class WaitForRender implements ShouldQueue
{
    public function handle(): void
    {
        $status = Http::timeout(3)->get("{$this->api}/renders/{$this->id}")->json('status');
        if ($status === 'running') {
            $this->release(min(60, 5 * 2 ** $this->attempts()));
            return;
        }
    }

    public function poll(): void
    {
        while (Http::timeout(3)->get("{$this->api}/renders/{$this->id}")->json('status') === 'running') {
            sleep(2);
        }
    }
}
