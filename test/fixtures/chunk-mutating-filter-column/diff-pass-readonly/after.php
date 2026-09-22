<?php
Order::where('status', 'open')->chunk(200, function ($orders) {
    foreach ($orders as $o) {
        Report::push($o->total);
    }
});
