<?php
$latest = Order::where('user_id', $id)->latest('id')->first();
$loaded = $orders->first();
$match = ValueListItem::query()->where('list_id', $id)->get()
    ->first(fn ($item) => mb_strtolower($item->label) === $wording); // PHP logic on the rows
$one = Order::where('user_id', $id)->limit(1)->get()->first();       // already LIMIT 1
