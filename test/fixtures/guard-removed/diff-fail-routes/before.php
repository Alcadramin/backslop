<?php

use App\Http\Controllers\OrderController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'can:manage-orders'])->group(function () {
    Route::post('/orders/{order}/refund', [OrderController::class, 'refund']);
});
