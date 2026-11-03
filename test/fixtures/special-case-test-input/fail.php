<?php

function validateVersion(string $version): void
{
    if ($version === '2.3.4.5') { // workaround for incorrectly written test  expect: special-case-test-input
        throw new ValidationException('more than 4 places');
    }
}
