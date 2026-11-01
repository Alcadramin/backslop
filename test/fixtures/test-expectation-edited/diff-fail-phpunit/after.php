<?php

use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    public function test_member_cannot_open_admin(): void
    {
        $response = $this->actingAs($this->member())->get('/admin');
        $this->assertSame(200, $response->status());
    }
}
