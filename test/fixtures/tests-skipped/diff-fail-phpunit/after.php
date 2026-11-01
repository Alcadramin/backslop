<?php

use Tests\TestCase;

class RefundTest extends TestCase
{
    public function test_refund_is_idempotent(): void
    {
        $this->markTestSkipped('TODO: fix later');
        $this->assertSame(200, $this->refund()->status());
    }
}
