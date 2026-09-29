<?php
class Honest
{
    public function run(array $users): array
    {
        // all the matches are used
        $admins = array_values(array_filter($users, fn ($u) => $u->isAdmin()));
        $count = count($admins);
        // "at least two" can't short-circuit at the first match
        $several = count(array_filter($users, fn ($u) => $u->banned)) > 1;
        // the short-circuiting forms
        $admin = array_find($users, fn ($u) => $u->isAdmin());
        $any = array_any($users, fn ($u) => $u->banned);
        // indexing a plain list
        $firstUser = $users[0] ?? null;
        return [$admins, $count, $several, $admin, $any, $firstUser];
    }
}
