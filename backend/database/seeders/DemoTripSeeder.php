<?php

namespace Database\Seeders;

use App\Context\EventType;
use App\Context\Source;
use App\Context\StatusTrips;
use App\Models\Company;
use App\Models\Port;
use App\Models\Trip;
use App\Models\Truck;
use App\Models\User;
use App\Models\VesselSchedule;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * One trip per status (StatusTrips), so the admin/driver dashboards have
 * something to show in every stage of the lifecycle without having to
 * manually click Recommend -> Assign -> Start -> Simulate through the whole
 * flow first. HistoricalTripSeeder already covers a pile of same-shape
 * COMPLETED domestic trips for the /recommend delay_penalty term — this is
 * about status variety, not volume.
 *
 * at_destination_port is deliberately skipped: TripController::markShipArrived()
 * now transitions straight on_ship -> completed (2026-08-16 fix), so nothing in
 * the app can currently reach or leave that status — seeding a trip stuck there
 * would just look broken, not representative.
 */
class DemoTripSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('username', 'admin')->first();
        $internal = Company::where('type', 'internal')->first();
        $partners = Company::where('type', 'partner')->where('city', $internal?->city)->get();

        $batuAmpar = Port::where('name', 'like', '%Batu Ampar%')->first();
        $sekupang = Port::where('name', 'like', '%Sekupang%')->first();
        $batamCentre = Port::where('name', 'like', '%Batam Centre%')->first();
        $psa = Port::where('name', 'like', '%PSA%')->first();
        $jurong = Port::where('name', 'like', '%Jurong%')->first();
        $tuas = Port::where('name', 'like', '%Tuas Port%')->first();

        if (! $admin || ! $internal || $partners->count() < 3 || ! $batuAmpar || ! $sekupang || ! $batamCentre || ! $psa || ! $jurong || ! $tuas) {
            return;
        }

        // Idempotent, same pattern as HistoricalTripSeeder: a fixed marker route
        // (this exact port pair, at_origin_port) only ever exists once these demo
        // trips have already been seeded.
        if (Trip::where('status', StatusTrips::AT_ORIGIN_PORT)->where('destination_port_id', $batuAmpar->id)->exists()) {
            return;
        }

        $driver2 = User::where('username', 'driver2')->first();
        $driver3 = User::where('username', 'driver3')->first();
        $driver4 = User::where('username', 'driver4')->first();
        $driver5 = User::where('username', 'driver5')->first();
        $driver1 = User::where('username', 'driver')->first();

        $truck1 = Truck::where('plate_number', 'BP 1001 XY')->first();
        $truck2 = Truck::where('plate_number', 'BP 1002 XY')->first();
        $truck3 = Truck::where('plate_number', 'BP 1003 XY')->first();
        $truck4 = Truck::where('plate_number', 'BP 1004 XY')->first(); // electric

        $schedule1 = VesselSchedule::where('ship_ref_id', '563123456')->first();
        $schedule2 = VesselSchedule::where('ship_ref_id', '563987654')->first();

        $now = Carbon::now();

        // 1. draft, domestic — nothing chosen yet.
        Trip::create([
            'origin_company_id' => $internal->id,
            'destination_company_id' => $partners[0]->id,
            'status' => StatusTrips::DRAFT,
            'created_by' => $admin->id,
        ]);

        // 2. draft, cross-border — nothing chosen yet.
        Trip::create([
            'origin_company_id' => $internal->id,
            'destination_port_id' => $batuAmpar->id,
            'ship_destination_port_id' => $psa->id,
            'status' => StatusTrips::DRAFT,
            'created_by' => $admin->id,
        ]);

        // 3. assigned, domestic — recommend() already run, truck/driver/time chosen,
        // hasn't departed yet. recommended_slots shaped like a real /recommend
        // response so InfoTab/AssignTab render it exactly like the real thing.
        $chosenAt = $now->copy()->addDay()->setTime(6, 0);
        Trip::create([
            'origin_company_id' => $internal->id,
            'destination_company_id' => $partners[1]->id,
            'truck_id' => $truck1?->id,
            'driver_id' => $driver1?->id,
            'status' => StatusTrips::ASSIGNED,
            'distance_km' => 6.4,
            'estimated_duration_min' => 18,
            'chosen_departure_at' => $chosenAt,
            'recommended_slots' => [
                ['departure_at' => $chosenAt->toIso8601String(), 'estimated_arrival_at' => $chosenAt->copy()->addMinutes(18)->toIso8601String(), 'score' => 98.5, 'is_recommended' => true, 'is_night' => false, 'distance_km' => 6.4, 'travel_time_seconds' => 1080, 'traffic_delay_seconds' => 0, 'reason' => '06:00 — recommended, light traffic, estimated arrival 06:18', 'breakdown' => ['base' => 100, 'traffic_penalty' => 1.5, 'delay_penalty' => 0, 'night_penalty' => 0, 'historical_sample_size' => 0]],
                ['departure_at' => $chosenAt->copy()->setTime(12, 0)->toIso8601String(), 'estimated_arrival_at' => $chosenAt->copy()->setTime(12, 21)->toIso8601String(), 'score' => 94.2, 'is_recommended' => false, 'is_night' => false, 'distance_km' => 6.4, 'travel_time_seconds' => 1260, 'traffic_delay_seconds' => 90, 'reason' => '12:00 — alternative, moderate traffic, estimated arrival 12:21', 'breakdown' => ['base' => 100, 'traffic_penalty' => 5.8, 'delay_penalty' => 0, 'night_penalty' => 0, 'historical_sample_size' => 0]],
                ['departure_at' => $chosenAt->copy()->setTime(18, 30)->toIso8601String(), 'estimated_arrival_at' => $chosenAt->copy()->setTime(18, 50)->toIso8601String(), 'score' => 96.1, 'is_recommended' => false, 'is_night' => false, 'distance_km' => 6.4, 'travel_time_seconds' => 1200, 'traffic_delay_seconds' => 30, 'reason' => '18:30 — alternative, light traffic, estimated arrival 18:50', 'breakdown' => ['base' => 100, 'traffic_penalty' => 3.9, 'delay_penalty' => 0, 'night_penalty' => 0, 'historical_sample_size' => 0]],
            ],
            'created_by' => $admin->id,
        ]);

        // 4. in_transit_origin, domestic — truck is on the road right now.
        $departedAt4 = $now->copy()->subHours(1)->subMinutes(20);
        $trip4 = Trip::create([
            'origin_company_id' => $internal->id,
            'destination_company_id' => $partners[2]->id,
            'truck_id' => $truck2?->id,
            'driver_id' => $driver2?->id,
            'status' => StatusTrips::IN_TRANSIT_ORIGIN,
            'distance_km' => 8.1,
            'estimated_duration_min' => 22,
            'chosen_departure_at' => $departedAt4,
            'actual_departure_at' => $departedAt4,
            'created_by' => $admin->id,
        ]);
        $trip4->checkpoints()->create([
            'event_type' => EventType::DEPARTED,
            'latitude' => $internal->latitude,
            'longitude' => $internal->longitude,
            'source' => Source::GPS,
            'recorded_at' => $departedAt4,
        ]);

        // 5. at_origin_port, cross-border — truck dropped cargo, waiting for the
        // ship (Simulate Vessel / a real teammate's ship-status poll would move
        // this to on_ship next). Reuses schedule 1's ship_ref_id if it exists.
        $departedAt5 = $now->copy()->subHours(3);
        $arrivedPortAt5 = $now->copy()->subHours(2)->subMinutes(40);
        $trip5 = Trip::create([
            'origin_company_id' => $internal->id,
            'destination_port_id' => $batuAmpar->id,
            'ship_destination_port_id' => $psa->id,
            'truck_id' => $truck3?->id,
            'driver_id' => $driver3?->id,
            'ship_ref_id' => $schedule1?->ship_ref_id ?? '563123456',
            'vessel_schedule_id' => $schedule1?->id,
            'status' => StatusTrips::AT_ORIGIN_PORT,
            'distance_km' => 11.2,
            'estimated_duration_min' => 25,
            'chosen_departure_at' => $departedAt5,
            'actual_departure_at' => $departedAt5,
            'created_by' => $admin->id,
        ]);
        $trip5->checkpoints()->createMany([
            ['event_type' => EventType::DEPARTED, 'latitude' => $internal->latitude, 'longitude' => $internal->longitude, 'source' => Source::GPS, 'recorded_at' => $departedAt5],
            ['event_type' => EventType::ARRIVED_AT_PORT, 'latitude' => $batuAmpar->latitude, 'longitude' => $batuAmpar->longitude, 'source' => Source::GPS, 'recorded_at' => $arrivedPortAt5],
        ]);

        // 6. on_ship, cross-border — cargo is at sea. Electric truck already back
        // at base (truck_returned_at set) — the ship's own status is independent.
        $departedAt6 = $now->copy()->subDays(1)->subHours(2);
        $arrivedPortAt6 = $now->copy()->subDays(1)->subHours(1)->subMinutes(35);
        $shipDepartedAt6 = $now->copy()->subHours(6);
        $truckReturnedAt6 = $now->copy()->subHours(4);
        $trip6 = Trip::create([
            'origin_company_id' => $internal->id,
            'destination_port_id' => $sekupang->id,
            'ship_destination_port_id' => $jurong->id,
            'truck_id' => $truck4?->id,
            'driver_id' => $driver4?->id,
            'ship_ref_id' => $schedule2?->ship_ref_id ?? '563987654',
            'vessel_schedule_id' => $schedule2?->id,
            'status' => StatusTrips::ON_SHIP,
            'distance_km' => 9.6,
            'estimated_duration_min' => 24,
            'chosen_departure_at' => $departedAt6,
            'actual_departure_at' => $departedAt6,
            'truck_returned_at' => $truckReturnedAt6,
            'created_by' => $admin->id,
        ]);
        $trip6->checkpoints()->createMany([
            ['event_type' => EventType::DEPARTED, 'latitude' => $internal->latitude, 'longitude' => $internal->longitude, 'source' => Source::GPS, 'recorded_at' => $departedAt6],
            ['event_type' => EventType::ARRIVED_AT_PORT, 'latitude' => $sekupang->latitude, 'longitude' => $sekupang->longitude, 'source' => Source::GPS, 'recorded_at' => $arrivedPortAt6],
            ['event_type' => EventType::SHIP_DEPARTED, 'latitude' => $sekupang->latitude, 'longitude' => $sekupang->longitude, 'source' => Source::GPS, 'recorded_at' => $shipDepartedAt6],
            ['event_type' => EventType::DEPARTED, 'latitude' => $sekupang->latitude, 'longitude' => $sekupang->longitude, 'source' => Source::GPS, 'recorded_at' => $truckReturnedAt6],
            ['event_type' => EventType::TRUCK_RETURNED, 'latitude' => $internal->latitude, 'longitude' => $internal->longitude, 'source' => Source::GPS, 'recorded_at' => $truckReturnedAt6],
        ]);

        // 7. completed, cross-border — full lifecycle, ship already arrived
        // (markShipArrived() sets status straight to completed).
        $departedAt7 = $now->copy()->subDays(3);
        $arrivedPortAt7 = $now->copy()->subDays(3)->addMinutes(20);
        $shipDepartedAt7 = $now->copy()->subDays(3)->addHours(1);
        $shipArrivedAt7 = $now->copy()->subDays(2)->subHours(20);
        $truckReturnedAt7 = $now->copy()->subDays(2)->subHours(22);
        $trip7 = Trip::create([
            'origin_company_id' => $internal->id,
            'destination_port_id' => $batamCentre->id,
            'ship_destination_port_id' => $tuas->id,
            'truck_id' => $truck1?->id, // reused — that trip already finished, no live conflict
            'driver_id' => $driver5?->id,
            'ship_ref_id' => '563555777',
            'status' => StatusTrips::COMPLETED,
            'distance_km' => 7.9,
            'estimated_duration_min' => 19,
            'chosen_departure_at' => $departedAt7,
            'actual_departure_at' => $departedAt7,
            'actual_arrival_at' => $shipArrivedAt7,
            'truck_returned_at' => $truckReturnedAt7,
            'created_by' => $admin->id,
        ]);
        $trip7->checkpoints()->createMany([
            ['event_type' => EventType::DEPARTED, 'latitude' => $internal->latitude, 'longitude' => $internal->longitude, 'source' => Source::GPS, 'recorded_at' => $departedAt7],
            ['event_type' => EventType::ARRIVED_AT_PORT, 'latitude' => $batamCentre->latitude, 'longitude' => $batamCentre->longitude, 'source' => Source::GPS, 'recorded_at' => $arrivedPortAt7],
            ['event_type' => EventType::SHIP_DEPARTED, 'latitude' => $batamCentre->latitude, 'longitude' => $batamCentre->longitude, 'source' => Source::GPS, 'recorded_at' => $shipDepartedAt7],
            ['event_type' => EventType::DEPARTED, 'latitude' => $batamCentre->latitude, 'longitude' => $batamCentre->longitude, 'source' => Source::GPS, 'recorded_at' => $truckReturnedAt7],
            ['event_type' => EventType::TRUCK_RETURNED, 'latitude' => $internal->latitude, 'longitude' => $internal->longitude, 'source' => Source::GPS, 'recorded_at' => $truckReturnedAt7],
            ['event_type' => EventType::SHIP_ARRIVED, 'latitude' => $tuas->latitude, 'longitude' => $tuas->longitude, 'source' => Source::API, 'recorded_at' => $shipArrivedAt7],
        ]);

        // 8. cancelled, domestic — no truck/driver, matching the common real case
        // of a trip getting cancelled before it was ever assigned.
        Trip::create([
            'origin_company_id' => $internal->id,
            'destination_company_id' => $partners[0]->id,
            'status' => StatusTrips::CANCELLED,
            'created_by' => $admin->id,
        ]);
    }
}
