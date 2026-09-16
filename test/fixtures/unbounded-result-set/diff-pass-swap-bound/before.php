<?php
$orders = Order::where('status', 'open')->orderBy('id')->paginate(50);
