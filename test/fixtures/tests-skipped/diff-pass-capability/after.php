<?php

use Tests\TestCase;

class ImageWriterTest extends TestCase
{
    public function test_writes_avif(): void
    {
        if (!function_exists('imageavif')) {
            self::markTestSkipped('This GD build cannot encode AVIF.');
        }
        $songs = Song::factory()->count(3)->create();
        $added = $this->service->addPlayablesToPlaylist($playlist, $songs->skip(1));
        $this->assertSame(2, $added->count());
    }
}
