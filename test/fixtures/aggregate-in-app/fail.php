<?php
$revenue = Order::where('paid', true)->get()->sum('total'); // expect: aggregate-in-app
$avg = Order::all()->avg('total'); // expect: aggregate-in-app
$byKind = $this->items()
    ->get(['kind', 'outcome']) // expect: aggregate-in-app
    ->groupBy('kind')
    ->map->count();
