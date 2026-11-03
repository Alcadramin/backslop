<?php

function changed(User $user): void
{
    Log::info('Password updated', ['user' => $user->id]);
    $this->info('Generated an API token for ' . $user->email);
    logger()->info('token refreshed', ['expires_at' => $user->token_expires_at]);
}
