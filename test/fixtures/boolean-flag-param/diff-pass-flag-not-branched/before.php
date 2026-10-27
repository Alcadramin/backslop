<?php

function saveUser(User $user): void
{
    $user->save();
}
