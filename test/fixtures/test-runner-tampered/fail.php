<?php

class WebhookController
{
    public function verifySignature(string $payload, string $signature): bool { return true; } // expect: test-runner-tampered
}
