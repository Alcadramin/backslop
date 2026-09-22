<?php
$names = User::where('active', 1)->pluck('name', 'id');
$ids = $orders->pluck('id');
$page = User::where('active', 1)->paginate(20)->pluck('name');
$names2 = collect($rows)->pluck('name');
