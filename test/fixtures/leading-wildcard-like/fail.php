<?php
$a = Product::where('name', 'like', "%{$q}%")->get(); // expect: leading-wildcard-like
$b = Product::where('sku', 'LIKE', '%' . $q)->get(); // expect: leading-wildcard-like
$c = Contact::whereLike('email', "%{$q}%")->get(); // expect: leading-wildcard-like
$d = DB::select("SELECT id FROM products WHERE name LIKE '%" . $q . "%'"); // expect: leading-wildcard-like
