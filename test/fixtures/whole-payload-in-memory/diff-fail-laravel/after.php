<?php
$csv = file_get_contents($path);
return response($csv, 200, ['Content-Type' => 'text/csv']);
