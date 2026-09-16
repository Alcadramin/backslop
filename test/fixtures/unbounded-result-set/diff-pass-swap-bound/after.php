<?php
$orders = Order::where('status', 'open')->orderBy('id')->cursorPaginate(50);
