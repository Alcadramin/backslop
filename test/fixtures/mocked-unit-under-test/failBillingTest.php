<?php

use Tests\TestCase;

class FailBillingTest extends TestCase
{
    public function test_charge(): void
    {
        $billing = $this->mock(failBilling::class); // expect: mocked-unit-under-test
        $billing->shouldReceive('charge')->andReturn(true);
        $this->assertTrue($billing->charge(100));
    }
}
