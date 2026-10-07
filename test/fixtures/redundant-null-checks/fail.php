<?php
class Mailer
{
    public function send(User $user, array $items, string $subject): void
    {
        if ($user === null) { // expect: redundant-null-checks
            return;
        }
        if (is_null($items)) { // expect: redundant-null-checks
            return;
        }
        $title = $subject ?? 'Hello'; // expect: redundant-null-checks
        $name = $user?->name; // expect: redundant-null-checks
        $this->transport->deliver($user, $items, $title, $name);
    }
}
