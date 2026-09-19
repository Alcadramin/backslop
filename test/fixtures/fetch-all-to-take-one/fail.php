<?php
$latest = Order::where('user_id', $id)->get()->last(); // expect: fetch-all-to-take-one
$any = Product::all()->random(); // expect: fetch-all-to-take-one
$first = Order::where('status', 'open')->orderBy('id')->get()->first(); // expect: fetch-all-to-take-one
