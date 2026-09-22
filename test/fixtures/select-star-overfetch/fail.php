<?php
$names = User::where('active', 1)->get()->pluck('name', 'id'); // expect: select-star-overfetch
$ids = Order::all()->pluck('id'); // expect: select-star-overfetch
