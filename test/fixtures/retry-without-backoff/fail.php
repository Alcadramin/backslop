<?php
class ErpSync
{
    public function push(array $order): void
    {
        Http::retry(3)->post('https://erp.example.com/orders', $order); // expect: retry-without-backoff
        Http::withToken($this->token)->retry(10, 0)->get('https://erp.example.com/ping'); // expect: retry-without-backoff
    }

    public function fetch(string $id): array
    {
        for ($i = 0; $i < 3; $i++) { // expect: retry-without-backoff
            try {
                return $this->client->get("/items/$id")->json();
            } catch (ConnectionException $e) {
                report($e);
            }
        }
        throw new RuntimeException('unreachable');
    }
}
