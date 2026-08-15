<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTripCheckpointRequest;
use App\Http\Resources\TripCheckpointResource;
use App\Models\Notification;
use App\Models\Trip;
use App\Models\TripCheckpoint;
use App\Traits\ApiResponse;
use App\Traits\ResolvesTripPoints;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class TripCheckpointController extends Controller
{
    use ApiResponse;
    use ResolvesTripPoints;

    /**
     * PRD Bagian 9 default is 500m and says it should be admin-configurable; lowered to
     * 100m 2026-08-15 (500m judged too loose to mean anything as an arrival check).
     * There's no settings/column for admins to actually change this yet, so it's a fixed
     * constant for now, not the configurable value the PRD describes.
     */
    protected const ARRIVAL_RADIUS_METERS = 100;

    #[OA\Post(
        path: '/trips/{id}/checkpoints',
        summary: 'Record a driver GPS ping, departure, or arrival confirmation',
        description: 'Driver only, and only the trip\'s own assigned driver. event_type drives 3 different '
            .'behaviors: gps_ping is a lightweight periodic position update while in transit (no status change, '
            .'expected to be called every few seconds per PRD Bagian 8.3 watchPosition, kept minimal on purpose); '
            .'departed starts a leg without necessarily changing status: first leg (assigned -> in_transit_origin), '
            .'a domestic return leg (arrived -> in_transit_destination, when origin is the internal company and '
            .'destination a partner, PRD Bagian 5.1), or a cross-border truck\'s return leg (status stays '
            .'at_origin_port, that field tracks the ship not the truck); arrived_at_destination/arrived_at_port/'
            .'arrived_final/truck_returned confirm arrival and are validated against the Haversine distance (PRD '
            .'Bagian 18) to the expected target point, only accepted within ARRIVAL_RADIUS_METERS, a '
            .'location_validation_failed notification fires otherwise (PRD Bagian 19) and nothing is recorded. '
            .'truck_returned sets truck_returned_at only (not status/actual_arrival_at, those are the ship\'s). '
            .'Which arrival event_type is valid depends on the trip\'s current status and whether it\'s '
            .'cross-border, sending the wrong one for the current state is rejected.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['event_type', 'latitude', 'longitude'],
                properties: [
                    new OA\Property(property: 'event_type', type: 'string', enum: ['departed', 'gps_ping', 'arrived_at_destination', 'arrived_at_port', 'arrived_final', 'truck_returned']),
                    new OA\Property(property: 'latitude', type: 'number', format: 'float'),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float'),
                ]
            )
        ),
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Kedatangan tervalidasi'),
                        new OA\Property(property: 'data', properties: [
                            new OA\Property(property: 'checkpoint', ref: '#/components/schemas/TripCheckpoint', nullable: true),
                            new OA\Property(property: 'trip_status', type: 'string'),
                        ], type: 'object', nullable: true),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden, not this trip\'s driver'),
            new OA\Response(response: 404, description: 'Trip not found'),
            new OA\Response(response: 422, description: 'Validation error, wrong event_type for the trip\'s current status, or arrival outside the allowed radius'),
        ]
    )]
    public function store(StoreTripCheckpointRequest $request, Trip $trip)
    {
        if ($trip->driver_id !== $request->user()->id) {
            abort(403, 'Trip ini bukan milik Anda.');
        }

        $latitude = (float) $request->input('latitude');
        $longitude = (float) $request->input('longitude');

        return match ($request->input('event_type')) {
            'gps_ping' => $this->recordGpsPing($trip, $latitude, $longitude),
            'departed' => $this->recordDeparture($trip, $latitude, $longitude),
            default => $this->recordArrival($trip, $request->input('event_type'), $latitude, $longitude),
        };
    }

    #[OA\Get(
        path: '/trips/{id}/checkpoints',
        summary: 'List a trip\'s checkpoint history',
        description: 'Admin can view any trip\'s checkpoints. Driver can only view their own assigned trip\'s. '
            .'Full history in departure order, not meant to be polled, use GET /trips/{id}/position for a live '
            .'single current point instead.',
        security: [['sanctum' => []]],
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'OK'),
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(ref: '#/components/schemas/TripCheckpoint')),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden, trip not assigned to this driver'),
            new OA\Response(response: 404, description: 'Trip not found'),
        ]
    )]
    public function index(Request $request, Trip $trip)
    {
        if ($request->user()->role !== 'admin' && $trip->driver_id !== $request->user()->id) {
            abort(403, 'Trip ini bukan milik Anda.');
        }

        $checkpoints = $trip->checkpoints()->orderBy('recorded_at')->get();

        return $this->success(TripCheckpointResource::collection($checkpoints));
    }

    /**
     * High-frequency by design (frontend polls this every ~3s per driver while in
     * transit, PRD Bagian 8.3), so this stays a plain insert: no relation loading, no
     * notification, no trip reload after the write.
     */
    protected function recordGpsPing(Trip $trip, float $latitude, float $longitude)
    {
        if (! in_array($trip->status, ['in_transit_origin', 'in_transit_destination'], true)) {
            return $this->error('Trip tidak sedang dalam perjalanan.', 422);
        }

        TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => 'gps_ping',
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => 'gps',
            'recorded_at' => now(),
        ]);

        return $this->success(null, 'GPS ping recorded');
    }

    protected function recordDeparture(Trip $trip, float $latitude, float $longitude)
    {
        $trip->loadMissing(['originCompany', 'destinationCompany']);

        if ($trip->status === 'assigned') {
            // Only the very first departure sets actual_departure_at, the return leg's
            // departure below doesn't touch it, that column represents the whole trip's
            // start for historicalDelayPenalty() (TripController), not a per-leg value.
            $trip->update(['status' => 'in_transit_origin', 'actual_departure_at' => now()]);
        } elseif ($trip->status === 'arrived' && $this->needsReturnLeg($trip)) {
            $trip->update(['status' => 'in_transit_destination']);
        } elseif ($trip->status === 'at_origin_port') {
            // Cross-border truck starting its return leg. Deliberately doesn't touch
            // `status`, that field tracks the ship/cargo (on_ship/at_destination_port/
            // completed via the future ship-status polling), not the truck, so it stays
            // at_origin_port while the truck drives home independently.
        } else {
            return $this->error('Trip tidak dalam status yang bisa memulai perjalanan.', 422);
        }

        $checkpoint = TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => 'departed',
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => 'gps',
            'recorded_at' => now(),
        ]);

        return $this->success([
            'checkpoint' => new TripCheckpointResource($checkpoint),
            'trip_status' => $trip->status,
        ], 'Keberangkatan tercatat');
    }

    protected function recordArrival(Trip $trip, string $eventType, float $latitude, float $longitude)
    {
        $trip->loadMissing(['originCompany', 'originPort', 'destinationCompany', 'destinationPort']);

        // Which arrival event_type is valid, what point it must be near, and what happens
        // on success, all depend on the trip's current status (PRD Bagian 16 state chains)
        // and whether it's cross-border (PRD Bagian 5.1: destination_port_id is the truck's
        // own-country port, never the ship's final one, so it's still the right target here).
        [$expectedEventType, $target, $onSuccess] = match (true) {
            $trip->status === 'in_transit_origin' && $trip->ship_destination_port_id !== null => [
                'arrived_at_port',
                $this->resolvePoint($trip, 'destination'),
                fn () => ['status' => 'at_origin_port'],
            ],
            $trip->status === 'in_transit_origin' => [
                'arrived_at_destination',
                $this->resolvePoint($trip, 'destination'),
                fn () => $this->needsReturnLeg($trip)
                    ? ['status' => 'arrived']
                    : ['status' => 'completed', 'actual_arrival_at' => now()],
            ],
            $trip->status === 'in_transit_destination' => [
                'arrived_final',
                $this->resolvePoint($trip, 'origin'),
                fn () => ['status' => 'completed', 'actual_arrival_at' => now()],
            ],
            // Cross-border truck home again. Sets truck_returned_at only, not `status`
            // or actual_arrival_at, those belong to the ship's own eventual completion.
            $trip->status === 'at_origin_port' => [
                'truck_returned',
                $this->resolvePoint($trip, 'origin'),
                fn () => ['truck_returned_at' => now()],
            ],
            default => [null, null, null],
        };

        if ($expectedEventType === null) {
            return $this->error('Trip tidak sedang menunggu konfirmasi kedatangan.', 422);
        }

        if ($eventType !== $expectedEventType) {
            return $this->error("event_type harus '{$expectedEventType}' untuk status trip saat ini.", 422);
        }

        $distanceMeters = $this->haversineDistanceMeters($latitude, $longitude, $target['lat'], $target['lng']);

        if ($distanceMeters > self::ARRIVAL_RADIUS_METERS) {
            Notification::create([
                'user_id' => $trip->created_by,
                'trip_id' => $trip->id,
                'type' => 'location_validation_failed',
                'message' => "Trip #{$trip->id}: validasi lokasi gagal (jarak {$distanceMeters}m, radius maksimum ".self::ARRIVAL_RADIUS_METERS.'m).',
            ]);

            return $this->error("Lokasi terlalu jauh dari titik tujuan (jarak {$distanceMeters}m, radius maksimum ".self::ARRIVAL_RADIUS_METERS.'m).', 422);
        }

        $updates = $onSuccess();
        $trip->update($updates);

        $checkpoint = TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => $eventType,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => 'gps',
            'recorded_at' => now(),
        ]);

        Notification::create([
            'user_id' => $trip->created_by,
            'trip_id' => $trip->id,
            'type' => 'arrived_at_point',
            'message' => "Trip #{$trip->id} tiba di titik {$eventType}.",
        ]);

        if (($updates['status'] ?? null) === 'completed') {
            Notification::create([
                'user_id' => $trip->created_by,
                'trip_id' => $trip->id,
                'type' => 'trip_completed',
                'message' => "Trip #{$trip->id} telah selesai.",
            ]);
        }

        return $this->success([
            'checkpoint' => new TripCheckpointResource($checkpoint),
            'trip_status' => $trip->status,
        ], 'Kedatangan tervalidasi');
    }

    /**
     * PRD Bagian 18, verbatim.
     */
    protected function haversineDistanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusMeters = 6371000;

        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadiusMeters * $c, 1);
    }
}
