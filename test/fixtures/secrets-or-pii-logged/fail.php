<?php

function connect(string $password, string $apiKey): void
{
    Log::info("Login with password $password"); // expect: secrets-or-pii-logged
    logger()->debug('stripe', ['key' => $apiKey]); // expect: secrets-or-pii-logged
    error_log('secret: ' . config('services.stripe.secret') . $clientSecret); // expect: secrets-or-pii-logged
}
