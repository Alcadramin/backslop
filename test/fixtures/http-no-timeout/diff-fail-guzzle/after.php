<?php
$client = new \GuzzleHttp\Client([
    'base_uri' => 'https://api.example.com',
]);
$res = $client->get('/quote');
