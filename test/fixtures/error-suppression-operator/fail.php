<?php
class Fetcher
{
    public function fetch(string $url): array
    {
        $body = @file_get_contents($url); // expect: error-suppression-operator
        $data = @json_decode($body, true); // expect: error-suppression-operator
        $name = @$data['name']; // expect: error-suppression-operator
        @\rename($this->tmp, $this->target); // expect: error-suppression-operator
        return $data ?: [];
    }
}
