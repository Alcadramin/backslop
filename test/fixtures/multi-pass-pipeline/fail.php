<?php
class Pipelines
{
    public function emails(array $users): array
    {
        $emails = array_values(array_unique(array_filter(array_map( // expect: multi-pass-pipeline
            fn ($u) => strtolower(trim($u['email'])),
            array_filter($users, fn ($u) => $u['active'])
        ))));
        return $emails;
    }

    public function tags(string $value): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $value)))); // expect: multi-pass-pipeline
    }

    public function uuids(array $uris): array
    {
        return array_values(array_map( // expect: multi-pass-pipeline
            fn (string $uri): string => substr($uri, 0, -4),
            array_filter($uris, fn (string $uri): bool => str_ends_with($uri, '.vcf')),
        ));
    }

    public function nestedInClosure(array $groups): array
    {
        // the outer array_map is fine; the chain inside the callback is three passes per group
        return array_map(fn ($g) => array_values(array_unique(array_column($g['items'], 'sku'))), $groups); // expect: multi-pass-pipeline
    }
}
