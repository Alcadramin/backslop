<?php
$a = Product::where('sku', 'like', $q . '%')->limit(20)->get();     // prefix: index usable
$b = Product::whereFullText(['name', 'description'], $q)->limit(20)->get();
$c = 'percent like %s';
