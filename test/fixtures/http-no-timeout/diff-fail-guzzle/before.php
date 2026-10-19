<?php
$client = new \GuzzleHttp\Client([
    'base_uri' => 'https://api.example.com',
    'timeout' => 5,
    'connect_timeout' => 2,
]);
$res = $client->get('/quote');
