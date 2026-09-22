<?php
Order::where('status', 'open')->chunkById(200, function ($orders) {
    foreach ($orders as $o) {
        Report::push($o->total);
    }
});
