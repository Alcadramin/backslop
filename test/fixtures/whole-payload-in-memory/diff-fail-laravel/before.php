<?php
return response()->streamDownload(function () use ($path) {
    $in = fopen($path, 'r');
    while (($line = fgets($in)) !== false) {
        echo $line;
    }
}, 'export.csv');
