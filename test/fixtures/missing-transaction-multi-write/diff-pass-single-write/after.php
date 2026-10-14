<?php
class RenameUser
{
    public function handle(User $user, string $name): void
    {
        $user->update(['name' => $name]);
    }
}
