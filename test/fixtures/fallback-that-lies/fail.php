<?php
class AccountService
{
    public function balance(int $userId): int
    {
        try { return $this->ledger->balance($userId); } catch (\Throwable $e) { return 0; } // expect: fallback-that-lies
    }

    public function permissions(User $user): array
    {
        try {
            return $this->http->get("/users/{$user->id}/permissions")->json();
        } catch (\Exception $e) { // expect: fallback-that-lies
            return [];
        }
    }

    public function send(Mail $mail): bool
    {
        try {
            $this->mailer->send($mail);
            return true;
        } catch (\Throwable $e) { // expect: fallback-that-lies
            return true;
        }
    }
}
