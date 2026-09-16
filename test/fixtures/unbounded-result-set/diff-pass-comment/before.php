<?php
// TODO: maybe ->paginate(50) here later
$orders = Order::where('status', 'open')->get();
