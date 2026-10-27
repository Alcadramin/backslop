<?php

function log(string $m): void {}

function log2(float $x): float { return log($x) / log(2); }

function whatsNew(): array { return []; }

function isNew(Order $o): bool { return $o->created_at > now()->subDay(); }
