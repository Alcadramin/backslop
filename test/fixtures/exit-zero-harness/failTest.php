<?php

use Tests\TestCase;

class ExportTest extends TestCase
{
    public function test_export(): void
    {
        $this->export();
        exit(0); // expect: exit-zero-harness
    }
}
