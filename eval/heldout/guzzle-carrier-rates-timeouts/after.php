<?php

namespace App\Services\Shipping;

use GuzzleHttp\Client;

class CarrierRateClient
{
    private Client $http;

    public function __construct(string $baseUri, private string $apiKey)
    {
        $this->http = new Client([
            'base_uri' => $baseUri,
        ]);
    }

    /**
     * @return array<int, array{service: string, amount_cents: int, eta_days: int}>
     */
    public function quote(Shipment $shipment): array
    {
        try {
            $response = $this->http->post('/v2/rates', [
                'headers' => ['Authorization' => "Bearer {$this->apiKey}"],
                'json' => [
                    'origin' => $shipment->originPostcode,
                    'destination' => $shipment->destinationPostcode,
                    'weight_grams' => $shipment->weightGrams,
                ],
            ]);

            return json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR)['rates'] ?? [];
        } catch (\Throwable $e) {
            return [];
        }
    }
}
