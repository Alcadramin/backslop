<?php
$responses = Http::pool(fn (Pool $pool) => $ids->map(fn ($id) => $pool->get("$api/items/$id"))->all(), concurrency: 10);
$pair = Http::pool(fn (Pool $pool) => [
    $pool->get("$api/a"),
    $pool->get("$api/b"),
]);
// A loop that builds the pool from a list passed in: size unknown here, left to review.
$responses = Http::pool(function (Pool $pool) use ($urls): array {
    $requests = [];
    foreach ($urls as $name => $url) {
        $requests[] = $pool->as($name)->timeout(2)->get($url);
    }
    return $requests;
});
