<?php

namespace Database\Seeders;

use App\Context\VesselScheduleStatus;
use App\Models\Port;
use App\Models\VesselSchedule;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class VesselScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $batuAmpar = Port::where('name', 'like', '%Batu Ampar%')->first() ?? Port::first();
        $batamCentre = Port::where('name', 'like', '%Batam Centre%')->first() ?? $batuAmpar;
        $sekupang = Port::where('name', 'like', '%Sekupang%')->first() ?? $batuAmpar;

        $psa = Port::where('name', 'like', '%PSA%')->first() ?? Port::where('country', 'singapore')->first();
        $jurong = Port::where('name', 'like', '%Jurong%')->first() ?? $psa;
        $tuas = Port::where('name', 'like', '%Tuas%')->first() ?? $psa;

        $now = Carbon::now();

        // 1. Batam Fast 18 - On Time (Batu Ampar -> PSA)
        $sch1 = VesselSchedule::updateOrCreate(
            ['voyage_number' => 'BF-2026-081'],
            [
                'vessel_name' => 'Batam Fast 18',
                'ship_ref_id' => '563123456',
                'origin_port_id' => $batuAmpar->id,
                'destination_port_id' => $psa->id,
                'scheduled_departure_at' => $now->copy()->subMinutes(50),
                'scheduled_arrival_at' => $now->copy()->addMinutes(40),
                'actual_departure_at' => $now->copy()->subMinutes(48),
                'estimated_arrival_at' => $now->copy()->addMinutes(38),
                'status' => VesselScheduleStatus::ON_TIME,
                'current_latitude' => 1.2050,
                'current_longitude' => 103.9050,
                'current_speed_knots' => 18.5,
                'distance_to_destination_km' => 11.4,
                'distance_to_destination_nm' => 6.16,
                'variance_minutes' => -2,
                'tolerance_minutes' => 30,
                'notes' => 'Regular container shuttle service. Weather clear.',
            ]
        );

        // 2. Majestic Pride - Delayed (+45 mins) (PSA -> Batu Ampar)
        $sch2 = VesselSchedule::updateOrCreate(
            ['voyage_number' => 'MJ-2026-104'],
            [
                'vessel_name' => 'Majestic Pride',
                'ship_ref_id' => '563987654',
                'origin_port_id' => $psa->id,
                'destination_port_id' => $batuAmpar->id,
                'scheduled_departure_at' => $now->copy()->subMinutes(90),
                'scheduled_arrival_at' => $now->copy()->addMinutes(15),
                'actual_departure_at' => $now->copy()->subMinutes(45),
                'estimated_arrival_at' => $now->copy()->addMinutes(60),
                'status' => VesselScheduleStatus::DELAYED,
                'current_latitude' => 1.2350,
                'current_longitude' => 103.8800,
                'current_speed_knots' => 12.0,
                'distance_to_destination_km' => 15.2,
                'distance_to_destination_nm' => 8.21,
                'variance_minutes' => 45,
                'tolerance_minutes' => 30,
                'notes' => 'Delayed departure due to heavy channel traffic in Singapore Straits.',
            ]
        );

        // 3. Asian Express 2 - Early Arrival (-35 mins) (Sekupang -> Jurong Port)
        $sch3 = VesselSchedule::updateOrCreate(
            ['voyage_number' => 'AE-2026-042'],
            [
                'vessel_name' => 'Asian Express 2',
                'ship_ref_id' => '563554433',
                'origin_port_id' => $sekupang->id,
                'destination_port_id' => $jurong->id,
                'scheduled_departure_at' => $now->copy()->subMinutes(60),
                'scheduled_arrival_at' => $now->copy()->addMinutes(60),
                'actual_departure_at' => $now->copy()->subMinutes(58),
                'estimated_arrival_at' => $now->copy()->addMinutes(25),
                'status' => VesselScheduleStatus::EARLY,
                'current_latitude' => 1.2200,
                'current_longitude' => 103.7800,
                'current_speed_knots' => 22.4,
                'distance_to_destination_km' => 8.5,
                'distance_to_destination_nm' => 4.59,
                'variance_minutes' => -35,
                'tolerance_minutes' => 25,
                'notes' => 'High speed cargo craft cruising at 22+ knots. Early arrival anticipated.',
            ]
        );

        // 4. Samudera Jaya - Scheduled (Batu Ampar -> Tuas Port)
        $sch4 = VesselSchedule::updateOrCreate(
            ['voyage_number' => 'SJ-2026-301'],
            [
                'vessel_name' => 'Samudera Jaya',
                'ship_ref_id' => '563889900',
                'origin_port_id' => $batuAmpar->id,
                'destination_port_id' => $tuas->id,
                'scheduled_departure_at' => $now->copy()->addHours(3),
                'scheduled_arrival_at' => $now->copy()->addHours(6),
                'status' => VesselScheduleStatus::SCHEDULED,
                'current_latitude' => (float) $batuAmpar->latitude,
                'current_longitude' => (float) $batuAmpar->longitude,
                'current_speed_knots' => 0.0,
                'distance_to_destination_km' => 42.1,
                'distance_to_destination_nm' => 22.73,
                'variance_minutes' => 0,
                'tolerance_minutes' => 30,
                'notes' => 'Evening heavy container delivery batch.',
            ]
        );

        // 5. Pacific Carrier - Berthing (Jurong Port -> Batu Ampar)
        $sch5 = VesselSchedule::updateOrCreate(
            ['voyage_number' => 'PC-2026-019'],
            [
                'vessel_name' => 'Pacific Carrier',
                'ship_ref_id' => '563441122',
                'origin_port_id' => $jurong->id,
                'destination_port_id' => $batuAmpar->id,
                'scheduled_departure_at' => $now->copy()->subHours(2),
                'scheduled_arrival_at' => $now->copy()->subMinutes(5),
                'actual_departure_at' => $now->copy()->subHours(2),
                'estimated_arrival_at' => $now->copy(),
                'status' => VesselScheduleStatus::BERTHING,
                'current_latitude' => 1.1690,
                'current_longitude' => 103.9940,
                'current_speed_knots' => 2.1,
                'distance_to_destination_km' => 0.6,
                'distance_to_destination_nm' => 0.32,
                'variance_minutes' => 5,
                'tolerance_minutes' => 30,
                'notes' => 'Currently berthing at Berth 04 Batu Ampar.',
            ]
        );

        // 6. Batam Star 9 - Arrived (Batam Centre -> PSA)
        $sch6 = VesselSchedule::updateOrCreate(
            ['voyage_number' => 'BS-2026-905'],
            [
                'vessel_name' => 'Batam Star 9',
                'ship_ref_id' => '563776655',
                'origin_port_id' => $batamCentre->id,
                'destination_port_id' => $psa->id,
                'scheduled_departure_at' => $now->copy()->subHours(4),
                'scheduled_arrival_at' => $now->copy()->subHours(2),
                'actual_departure_at' => $now->copy()->subHours(4),
                'actual_arrival_at' => $now->copy()->subHours(2)->addMinutes(4),
                'estimated_arrival_at' => $now->copy()->subHours(2)->addMinutes(4),
                'status' => VesselScheduleStatus::ARRIVED,
                'current_latitude' => (float) $psa->latitude,
                'current_longitude' => (float) $psa->longitude,
                'current_speed_knots' => 0.0,
                'distance_to_destination_km' => 0.0,
                'distance_to_destination_nm' => 0.0,
                'variance_minutes' => 4,
                'tolerance_minutes' => 30,
                'notes' => 'Successfully docked and cargo offloaded.',
            ]
        );

        // Auto-link existing cross-border trips with matching vessel schedules
        $crossBorderTrips = \App\Models\Trip::whereNotNull('ship_destination_port_id')->get();
        foreach ($crossBorderTrips as $trip) {
            $matchingSchedule = VesselSchedule::where('ship_ref_id', $trip->ship_ref_id)->first()
                ?? VesselSchedule::where('destination_port_id', $trip->ship_destination_port_id)->first();
            if ($matchingSchedule) {
                $trip->update([
                    'vessel_schedule_id' => $matchingSchedule->id,
                    'ship_ref_id' => $matchingSchedule->ship_ref_id,
                ]);
            }
        }
    }
}
