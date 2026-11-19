<?php

function activeTagNames(array $posts, array $banned): array
{
    $bannedSet = array_flip($banned);
    $names = [];
    foreach ($posts as $post) {
        foreach ($post['tags'] as $tag) {
            if (!isset($bannedSet[$tag['name']])) {
                $names[$tag['name']] = true;
            }
        }
    }
    return array_keys($names);
}
