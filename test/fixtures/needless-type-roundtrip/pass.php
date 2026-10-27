<?php

final class WebhookController
{
    public function handle(Request $request): JsonResponse
    {
        // Decoding the request body once at the boundary is the job, not a round-trip.
        $payload = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $body = json_encode(['ok' => true], JSON_THROW_ON_ERROR);
        $label = 'json_decode(json_encode($x)) is slow'; // a string, not code
        // json_decode(json_encode($order), true);  <- commented out, not code
        return new JsonResponse($body);
    }

    public function snapshot(Order $order): array
    {
        // Same shape the queue worker reads back after JSON serialization.
        return json_decode(json_encode($order), true);
    }
}
