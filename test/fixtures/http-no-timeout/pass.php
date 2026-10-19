<?php
namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\RequestOptions;

class QuoteService
{
    public function __construct(private array $config) {}

    public function quote(string $sku): array
    {
        // a timeout set per request still counts
        $client = new Client(['base_uri' => 'https://api.example.com']);
        $res = $client->get("/quote/$sku", [RequestOptions::TIMEOUT => 3]);
        return json_decode((string) $res->getBody(), true);
    }

    public function fromConfig(): Client
    {
        // options built elsewhere: can't tell, don't guess
        return new Client($this->config);
    }
}
