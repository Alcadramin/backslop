<?php
$orders = Order::where('status', 'open')->get();
