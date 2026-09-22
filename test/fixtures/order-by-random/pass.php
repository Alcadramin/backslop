<?php
$max = Product::max('id');
$p = Product::where('id', '>=', random_int(1, $max))->orderBy('id')->first();
$ids = Arr::random($ids, 3);                     // PHP array, not a query
// ->inRandomOrder() would sort the whole table
