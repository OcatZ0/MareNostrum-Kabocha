<?php

namespace Database\Seeders;

use App\Context\CompanyType;
use App\Context\EventType;
use App\Context\Source;
use App\Context\StatusTrips;
use App\Models\Company;
use App\Models\Trip;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class HistoricalTripSeeder extends Seeder
{
    /**
     * Fabricated completed trips on the internal company's domestic route to its
     * first Batam partner, so the /recommend delay_penalty term (PRD Bagian 17) has
     * something to compute against. No real trip has ever completed yet — these
     * numbers are made up to unblock the demo, not measured. Pattern: morning
     * departures run close to estimate, midday runs a bit late, night departures run
     * the latest (on top of the fixed night_penalty), so the scoring story is
     * coherent end to end.
     */
    private const DELAY_PATTERN = [
        6 => [3, 5, 4],
        13 => [12, 15, 18],
        22 => [25, 30, 35],
    ];

    private const ESTIMATED_DURATION_MIN = 40;

    public function run(): void
    {
        $admin = User::where('username', 'admin')->first();
        $driver = User::where('username', 'driver')->first();
        $internal = Company::where('type', CompanyType::INTERNAL)->first();
        $partner = Company::where('type', CompanyType::PARTNER)->where('city', $internal?->city)->first();

        if (! $admin || ! $driver || ! $internal || ! $partner) {
            return;
        }

        // Idempotent: skip if this seeder has already run, so repeated `db:seed`
        // calls don't keep piling up duplicate fake history.
        if (Trip::where('status', StatusTrips::COMPLETED)->where('origin_company_id', $internal->id)->where('destination_company_id', $partner->id)->exists()) {
            return;
        }

        foreach (self::DELAY_PATTERN as $hour => $delays) {
            foreach ($delays as $i => $delayMinutes) {
                $departedAt = Carbon::today()->subDays(7 + $i)->setTime($hour, 0);
                $arrivedAt = $departedAt->copy()->addMinutes(self::ESTIMATED_DURATION_MIN + $delayMinutes);

                $trip = Trip::create([
                    'origin_company_id' => $internal->id,
                    'destination_company_id' => $partner->id,
                    'driver_id' => $driver->id,
                    'status' => StatusTrips::COMPLETED,
                    'estimated_duration_min' => self::ESTIMATED_DURATION_MIN,
                    'actual_departure_at' => $departedAt,
                    'actual_arrival_at' => $arrivedAt,
                    'created_by' => $admin->id,
                ]);

                // Matching checkpoint pair — historical_sample_size (recommend()'s
                // delay_penalty term) reads actual_departure_at/actual_arrival_at
                // directly off the trip, not the checkpoints, so these aren't needed
                // for scoring, but a trip with zero checkpoint history looks broken
                // in the admin's Checkpoints tab regardless of how it's used elsewhere.
                $trip->checkpoints()->createMany([
                    [
                        'event_type' => EventType::DEPARTED,
                        'latitude' => $internal->latitude,
                        'longitude' => $internal->longitude,
                        'source' => Source::GPS,
                        'recorded_at' => $departedAt,
                    ],
                    [
                        'event_type' => EventType::ARRIVED_AT_DESTINATION,
                        'latitude' => $partner->latitude,
                        'longitude' => $partner->longitude,
                        'source' => Source::GPS,
                        'recorded_at' => $arrivedAt,
                    ],
                ]);
            }
        }
    }
}
