<?php
$res = Http::withHeaders([
])->timeout(5)->post('https://pay.example.com/charges', $charge);
