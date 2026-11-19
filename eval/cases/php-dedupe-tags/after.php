<?php

function activeTagNames(array $posts, array $banned): array
{
    $names = [];
    foreach ($posts as $post) {
        $names = array_merge($names, array_values(array_filter(array_map(fn ($t) => $t['name'], $post['tags']), fn ($n) => !in_array($n, $banned))));
    }
    return array_values(array_unique($names));
}
