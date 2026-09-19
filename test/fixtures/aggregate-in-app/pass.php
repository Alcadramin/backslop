<?php
$revenue = Order::where('paid', true)->sum('total');
$onPage = $orders->sum('total');
$byKind = Item::query()->selectRaw('kind, count(*) as total')->groupBy('kind')->get()->groupBy('kind');
$buckets = Version::query()->whereIn('id', $ids)->get(['id', 'structure_id'])->groupBy('structure_id'); // grouping for display
$rates = Order::where('paid', true)->get()->sum(fn ($o) => $o->total * $fx->rate($o->currency));      // per-row app logic
