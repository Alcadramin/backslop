<?php
class Honest
{
    public function run(array $users, array $columns, array $labels, array $rows): array
    {
        // two stages: a short pipeline reads fine
        $active = array_values(array_filter($users, fn ($u) => $u['active']));

        // the third call is array_diff's subtractor, not a stage the data flows through
        $fill = array_fill_keys(array_diff($columns, array_keys($labels)), null);

        // callbacks that use array functions per item are not stages
        $lists = array_map(fn ($r) => array_keys($r), array_filter($rows, fn ($r) => array_key_exists('id', $r)));

        // the one-pass version
        $emails = [];
        foreach ($users as $u) {
            if (!$u['active']) {
                continue;
            }
            $e = strtolower(trim($u['email']));
            if ($e !== '') {
                $emails[$e] = true;
            }
        }
        return [$active, $fill, $lists, array_keys($emails)];
    }
}
