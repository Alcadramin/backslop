<?php

it('sends the receipt', function () {
    expect(sendReceipt($this->order))->toBeTrue();
});
