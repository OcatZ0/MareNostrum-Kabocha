<?php

namespace Database\Seeders;

use App\Context\NotificationType;
use App\Context\StatusTrips;
use App\Models\Notification;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Depends on DemoTripSeeder having already run (DatabaseSeeder order) — pulls
 * real trip IDs from whatever demo trips exist rather than inventing fake
 * trip_id values, so NotificationsPage's trip links actually resolve.
 */
class NotificationSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('username', 'admin')->first();
        if (! $admin) {
            return;
        }

        // Idempotent, same pattern as the other seeders.
        if (Notification::where('type', NotificationType::GENERAL)->where('message', 'like', 'Welcome to Mare Nostrum%')->exists()) {
            return;
        }

        $assigned = Trip::where('status', StatusTrips::ASSIGNED)->latest('id')->first();
        $inTransit = Trip::where('status', StatusTrips::IN_TRANSIT_ORIGIN)->latest('id')->first();
        $atPort = Trip::where('status', StatusTrips::AT_ORIGIN_PORT)->latest('id')->first();
        $onShip = Trip::where('status', StatusTrips::ON_SHIP)->latest('id')->first();
        $completed = Trip::where('status', StatusTrips::COMPLETED)->latest('id')->first();
        $cancelled = Trip::where('status', StatusTrips::CANCELLED)->latest('id')->first();

        $rows = [];

        if ($assigned) {
            $rows[] = [
                'user_id' => $assigned->driver_id ?? $admin->id,
                'trip_id' => $assigned->id,
                'type' => NotificationType::TRIP_ASSIGNED,
                'message' => "You've been assigned to trip #{$assigned->id}, departure at ".$assigned->chosen_departure_at?->format('Y-m-d H:i'),
                'is_read' => false,
            ];
        }

        if ($inTransit) {
            $rows[] = [
                'user_id' => $admin->id,
                'trip_id' => $inTransit->id,
                'type' => NotificationType::ARRIVED_AT_POINT,
                'message' => "Trip #{$inTransit->id} departed and is now in transit.",
                'is_read' => true,
            ];
        }

        if ($atPort) {
            $rows[] = [
                'user_id' => $admin->id,
                'trip_id' => $atPort->id,
                'type' => NotificationType::ARRIVED_AT_POINT,
                'message' => "Trip #{$atPort->id} arrived at the departure port, waiting for the vessel.",
                'is_read' => false,
            ];
        }

        if ($onShip) {
            $rows[] = [
                'user_id' => $admin->id,
                'trip_id' => $onShip->id,
                'type' => NotificationType::SHIP_DEPARTED,
                'message' => "Vessel for trip #{$onShip->id} has departed and is en route.",
                'is_read' => false,
            ];
            $rows[] = [
                'user_id' => $onShip->driver_id ?? $admin->id,
                'trip_id' => $onShip->id,
                'type' => NotificationType::VESSEL_DELAY_WARNING,
                'message' => "Vessel for trip #{$onShip->id} is running slightly behind its scheduled ETA.",
                'is_read' => false,
            ];
        }

        if ($completed) {
            $rows[] = [
                'user_id' => $admin->id,
                'trip_id' => $completed->id,
                'type' => NotificationType::TRIP_COMPLETED,
                'message' => "Trip #{$completed->id} has completed.",
                'is_read' => true,
            ];
        }

        if ($cancelled) {
            $rows[] = [
                'user_id' => $admin->id,
                'trip_id' => $cancelled->id,
                'type' => NotificationType::TRIP_CANCELLED,
                'message' => "Trip #{$cancelled->id} was cancelled.",
                'is_read' => true,
            ];
        }

        $rows[] = [
            'user_id' => $admin->id,
            'trip_id' => null,
            'type' => NotificationType::GENERAL,
            'message' => 'Welcome to Mare Nostrum — cross-border logistics tracking for Batam and Singapore.',
            'is_read' => false,
        ];

        // create() in a loop, not insert() — insert() is a raw query builder
        // bulk-write that skips Eloquent's automatic created_at population.
        foreach ($rows as $row) {
            Notification::create($row);
        }
    }
}
