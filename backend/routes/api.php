<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\EmissionFactorController;
use App\Http\Controllers\PortController;
use App\Http\Controllers\TripCheckpointController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\TruckController;
use App\Http\Middleware\BypassAuthForTesting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// TEMPORARY: auth:sanctum swapped for BypassAuthForTesting until POST /api/login
// exists (PRD Bagian 14, Backend 1). Revert to 'auth:sanctum' once it's built —
// see app/Http/Middleware/BypassAuthForTesting.php for details.

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware(BypassAuthForTesting::class);

Route::middleware(BypassAuthForTesting::class)->group(function () {
    // Companies
    Route::apiResource('companies', CompanyController::class);

    // Ports
    Route::apiResource('ports', PortController::class);

    // Trucks
    Route::get('/trucks/{truck}/emissions', [TruckController::class, 'emissions']);
    Route::apiResource('trucks', TruckController::class);

    // Emission Factors
    Route::apiResource('emission-factors', EmissionFactorController::class)->only(['index', 'show']);

    // Analytics
    Route::get('/analytics/dashboard', [AnalyticsController::class, 'dashboard']);
    Route::get('/analytics/trips', [AnalyticsController::class, 'trips']);

    // Trips
    Route::get('/trips', [TripController::class, 'index']);
    Route::post('/trips', [TripController::class, 'store']);
    Route::get('/trips/{trip}', [TripController::class, 'show']);
    Route::put('/trips/{trip}', [TripController::class, 'update']);
    Route::post('/trips/{trip}/recommend', [TripController::class, 'recommend']);
    Route::post('/trips/{trip}/assign', [TripController::class, 'assign']);
    Route::post('/trips/{trip}/simulate', [TripController::class, 'simulate']);
    Route::post('/trips/{trip}/ship', [TripController::class, 'ship']);
    Route::post('/trips/{trip}/checkpoints', [TripCheckpointController::class, 'store']);
    Route::get('/trips/{trip}/checkpoints', [TripCheckpointController::class, 'index']);
    Route::get('/trips/{trip}/position', [TripController::class, 'position']);
    Route::get('/trips/{trip}/ship-status', [TripController::class, 'shipStatus']);
});

