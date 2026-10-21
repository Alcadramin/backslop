<?php
$responses = Http::pool(fn (Pool $pool) => $ids->map(fn ($id) => $pool->get("$api/items/$id"))->all()); // expect: unbounded-concurrency
