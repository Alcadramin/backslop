<?php
class RenameUser
{
    public function handle(User $user, string $name): void
    {
        DB::transaction(function () use ($user, $name) {
            $user->update(['name' => $name]);
        });
    }
}
