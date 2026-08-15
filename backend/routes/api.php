<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmissionFactorController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PortController;
use App\Http\Controllers\TripCheckpointController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\TruckController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VesselScheduleController;
use App\Http\Middleware\BypassAuthForTesting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Authentication
Route::post('/login', [AuthController::class, 'login']);

Route::middleware(BypassAuthForTesting::class)->group(function () {
    // Dedicated Dashboard Endpoint
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Auth & User Profile
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    Route::post('/logout', [AuthController::class, 'logout']);

    // Users & Drivers Management
    Route::apiResource('users', UserController::class);

    // Companies
    Route::apiResource('companies', CompanyController::class);

    // Ports
    Route::apiResource('ports', PortController::class);

    // Vessel Schedules
    Route::get('/vessel-schedules/template', [VesselScheduleController::class, 'template']);
    Route::post('/vessel-schedules/import', [VesselScheduleController::class, 'import']);
    Route::post('/vessel-schedules/{vesselSchedule}/check-status', [VesselScheduleController::class, 'checkStatus']);
    Route::apiResource('vessel-schedules', VesselScheduleController::class);

    // Trucks
    Route::get('/trucks/{truck}/emissions', [TruckController::class, 'emissions']);
    Route::apiResource('trucks', TruckController::class);

    // Emission Factors
    Route::apiResource('emission-factors', EmissionFactorController::class)->only(['index', 'show']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);

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

