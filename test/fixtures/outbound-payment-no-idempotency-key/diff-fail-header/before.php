<?php
$res = Http::withHeaders([
    'Idempotency-Key' => $order->payment_key,
])->timeout(5)->post('https://pay.example.com/charges', $charge);
