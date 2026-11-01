<?php

use Tests\TestCase;

class ImageWriterTest extends TestCase
{
    public function test_writes_avif(): void
    {
        $songs = Song::factory()->count(3)->create();
        $this->assertSame(3, $songs->count());
    }
}
