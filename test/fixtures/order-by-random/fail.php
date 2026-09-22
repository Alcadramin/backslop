<?php
$p = Product::inRandomOrder()->first(); // expect: order-by-random
$q = DB::select('SELECT id FROM products ORDER BY RAND() LIMIT 1'); // expect: order-by-random
