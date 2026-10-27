<?php

function saveUser(User $user, bool $touch = true): void
{
    $user->timestamps = $touch;
    $user->save();
}
