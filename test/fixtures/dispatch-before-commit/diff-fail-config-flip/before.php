<?php
return [
    'connections' => [
        'redis' => [
            'driver' => 'redis',
            'queue' => env('REDIS_QUEUE', 'default'),
            'after_commit' => true,
        ],
    ],
];
