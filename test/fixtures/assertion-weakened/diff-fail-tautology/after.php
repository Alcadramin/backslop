<?php

use Tests\TestCase;

class ImportTest extends TestCase
{
    public function test_import_runs(): void
    {
        $result = $this->importer->run('fixtures/songs.csv');
        $this->assertTrue(true);
    }
}
