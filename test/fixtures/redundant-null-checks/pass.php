<?php
class Mailer
{
    public function send(?User $user, ?array $items = null, string|null $subject = null, int $count = 0): void
    {
        if ($user === null) {
            return;
        }
        if (is_null($items)) {
            return;
        }
        $title = $subject ?? 'Hello';
        $this->transport->deliver($user, $items, $title, $count);
    }

    public function greet(User $user, array $options, string $name): string
    {
        $locale = $options['locale'] ?? 'en';
        $nick = $user->nickname ?? $name;
        $name = trim($name) ?: null;
        if ($name === null) {
            return 'Hi';
        }
        $fn = function (?User $user) {
            return $user === null ? 'guest' : $user->name;
        };
        return "Hi {$name}" . $fn($user) . $locale . $nick;
    }

    public function mixed(mixed $value, $untyped)
    {
        return $value === null || $untyped === null;
    }
}
