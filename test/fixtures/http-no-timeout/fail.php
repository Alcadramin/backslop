<?php
namespace App\Services;

use GuzzleHttp\Client;

class QuoteService
{
    public function quote(string $sku): array
    {
        $client = new Client(); // expect: http-no-timeout
        $res = $client->get("https://api.example.com/quote/$sku");
        return json_decode((string) $res->getBody(), true);
    }

    public function rates(): array
    {
        $client = new \GuzzleHttp\Client(['base_uri' => 'https://rates.example.com']); // expect: http-no-timeout
        return json_decode((string) $client->get('/latest')->getBody(), true);
    }
}
