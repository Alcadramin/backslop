<?php
class Importer
{
    public function run($file): bool
    {
        $h = fopen($file, 'r');
        try {
            return $this->import($h);
        } finally {
            fclose($h);
            return true; // expect: finally-overrides-exception
        }
    }
}
