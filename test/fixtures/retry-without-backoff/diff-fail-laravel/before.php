<?php
$res = Http::timeout(3)->retry(3, 500)->get('https://erp.example.com/ping');
