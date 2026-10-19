<?php
class WaitForRender
{
    public function handle(): void
    {
        while (Http::timeout(3)->get("{$this->api}/renders/{$this->id}")->json('status') === 'running') { // expect: busy-poll-loop
        }
    }
}
