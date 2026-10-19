<?php
class ErpSync
{
    public function push(array $order): void
    {
        Http::timeout(3)->retry(3, 200)->get('https://erp.example.com/orders');
        Http::retry([200, 600, 1500])->get('https://erp.example.com/ping');
        Http::retry(3, fn (int $attempt) => random_int(0, 200 * 2 ** $attempt))->get('https://erp.example.com/ping');
        // queue job retry, not the HTTP client
        $this->job->retry(3);
    }

    public function fetch(string $id): array
    {
        for ($i = 0; $i < 3; $i++) {
            try {
                return $this->client->get("/items/$id")->json();
            } catch (ConnectionException $e) {
                usleep(random_int(0, 100_000 * 2 ** $i));
            }
        }
        throw new RuntimeException('unreachable');
    }
}
