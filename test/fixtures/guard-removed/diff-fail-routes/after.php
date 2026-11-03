<?php

use App\Http\Controllers\OrderController;
use Illuminate\Support\Facades\Route;

Route::group([], function () {
    Route::post('/orders/{order}/refund', [OrderController::class, 'refund']);
});
