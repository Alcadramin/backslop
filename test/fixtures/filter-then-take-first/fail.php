<?php
class Finders
{
    public function run(array $users): array
    {
        $admin = array_filter($users, fn ($u) => $u->isAdmin())[0] ?? null; // expect: filter-then-take-first
        $owner = array_values(array_filter($users, fn ($u) => $u->isOwner()))[0] ?? null; // expect: filter-then-take-first
        $first = reset(array_filter($users, fn ($u) => $u->active)); // expect: filter-then-take-first
        $hasBanned = count(array_filter($users, fn ($u) => $u->banned)) > 0; // expect: filter-then-take-first
        $none = count(array_filter($users, fn ($u) => $u->banned)) === 0; // expect: filter-then-take-first
        return [$admin, $owner, $first, $hasBanned, $none];
    }
}
