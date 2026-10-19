<?php
class ChargeCard
{
    public function handle(Order $order): void
    {
        $key = $order->payment_idempotency_key ??= (string) Str::uuid();
        Http::withHeaders(['Idempotency-Key' => $key])->timeout(5)->retry(3, 300)->post('https://pay.example.com/charges', $order->charge());
    }

    public function ping(): void
    {
        // GET is safe to retry
        Http::timeout(2)->retry(3, 200)->get('https://pay.example.com/health');
        // retrying only when the connection failed before the request was sent
        Http::timeout(5)->retry(3, 300, fn ($e) => $e instanceof ConnectionException)->post('https://pay.example.com/charges', []);
    }
}
