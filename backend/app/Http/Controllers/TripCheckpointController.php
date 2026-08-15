<?php

namespace App\Http\Controllers;

use App\Context\EventType;
use App\Context\NotificationType;
use App\Context\Role;
use App\Context\Source;
use App\Context\StatusTrips;
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
            .'ship_departed (at_origin_port -> on_ship) and ship_arrived (on_ship -> at_destination_port) are the '
            .'Simulate Vessel feature\'s equivalent of the never-built real VesselAPI departure/arrival poller — '
            .'ship_departed optionally accepts destination_port_id to overwrite ship_destination_port_id with a '
            .'randomly-chosen other-island port for the simulated crossing. Which arrival event_type is valid '
            .'depends on the trip\'s current status and whether it\'s cross-border, sending the wrong one for the '
            .'current state is rejected.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['event_type', 'latitude', 'longitude'],
                properties: [
                    new OA\Property(property: 'event_type', type: 'string', enum: [EventType::DEPARTED, EventType::GPS_PING, EventType::ARRIVED_AT_DESTINATION, EventType::ARRIVED_AT_PORT, EventType::ARRIVED_FINAL, EventType::TRUCK_RETURNED, EventType::SHIP_DEPARTED, EventType::SHIP_ARRIVED]),
                    new OA\Property(property: 'latitude', type: 'number', format: 'float'),
                    new OA\Property(property: 'longitude', type: 'number', format: 'float'),
                    new OA\Property(property: 'destination_port_id', type: 'integer', nullable: true, description: 'ship_departed only: randomly-chosen other-island port ID, overwrites ship_destination_port_id.'),
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
                        new OA\Property(property: 'message', type: 'string', example: 'Arrival validated'),
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
            abort(403, 'This trip does not belong to you.');
        }

        $latitude = (float) $request->input('latitude');
        $longitude = (float) $request->input('longitude');

        return match ($request->input('event_type')) {
            EventType::GPS_PING => $this->recordGpsPing($trip, $latitude, $longitude),
            EventType::DEPARTED => $this->recordDeparture($trip, $latitude, $longitude),
            EventType::SHIP_DEPARTED => $this->recordShipDeparture($trip, $latitude, $longitude, $request->input('destination_port_id')),
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
        if ($request->user()->role !== Role::ADMIN && $trip->driver_id !== $request->user()->id) {
            abort(403, 'This trip does not belong to you.');
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
        // on_ship included so Simulate Vessel's periodic pings during the crossing land
        // here too — GET /trips/{id}/position already falls back to the latest GPS
        // checkpoint when it has no live VesselAPI data, so these pings get picked up
        // by the exact same live-map polling the truck legs use.
        if (! in_array($trip->status, [StatusTrips::IN_TRANSIT_ORIGIN, StatusTrips::IN_TRANSIT_DESTINATION, StatusTrips::ON_SHIP], true)) {
            return $this->error('Trip is not currently in transit.', 422);
        }

        TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => EventType::GPS_PING,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => Source::GPS,
            'recorded_at' => now(),
        ]);

        return $this->success(null, 'GPS ping recorded');
    }

    protected function recordDeparture(Trip $trip, float $latitude, float $longitude)
    {
        $trip->loadMissing(['originCompany', 'destinationCompany']);

        if ($trip->status === StatusTrips::ASSIGNED) {
            // Only the very first departure sets actual_departure_at, the return leg's
            // departure below doesn't touch it, that column represents the whole trip's
            // start for historicalDelayPenalty() (TripController), not a per-leg value.
            $trip->update(['status' => StatusTrips::IN_TRANSIT_ORIGIN, 'actual_departure_at' => now()]);
        } elseif ($trip->status === StatusTrips::ARRIVED && $this->needsReturnLeg($trip)) {
            $trip->update(['status' => StatusTrips::IN_TRANSIT_DESTINATION]);
        } elseif ($trip->status === StatusTrips::AT_ORIGIN_PORT) {
            // Cross-border truck starting its return leg. Deliberately doesn't touch
            // `status`, that field tracks the ship/cargo (on_ship/at_destination_port/
            // completed via the future ship-status polling), not the truck, so it stays
            // at_origin_port while the truck drives home independently.
        } else {
            return $this->error('Trip is not in a status that can start transit.', 422);
        }

        $checkpoint = TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => EventType::DEPARTED,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => Source::GPS,
            'recorded_at' => now(),
        ]);

        return $this->success([
            'checkpoint' => new TripCheckpointResource($checkpoint),
            'trip_status' => $trip->status,
        ], 'Departure recorded');
    }

    /**
     * Simulate Vessel's departure step. Real VesselAPI-driven departure detection
     * (mirroring markShipArrived()'s arrival detection) was never built (PRD Bagian 8.2
     * integration note), so this is the only thing that ever moves a trip out of
     * at_origin_port — either a real future poller or this simulated client trigger.
     * Optionally overwrites ship_destination_port_id with a randomly-chosen other-island
     * port for the duration of the simulated crossing (Simulate Vessel picks one from
     * GET /api/ports client-side), so the later ship_arrived Haversine check in
     * recordArrival() validates against wherever the simulated ship actually "sailed to"
     * rather than whatever was configured back when the trip was first created.
     */
    protected function recordShipDeparture(Trip $trip, float $latitude, float $longitude, ?int $destinationPortId)
    {
        if ($trip->status !== StatusTrips::AT_ORIGIN_PORT) {
            return $this->error('Trip is not currently waiting for the ship to depart.', 422);
        }

        if (! $trip->ship_ref_id) {
            return $this->error('Vessel reference ID has not been set for this trip.', 422);
        }

        $updates = ['status' => StatusTrips::ON_SHIP];
        if ($destinationPortId !== null) {
            $updates['ship_destination_port_id'] = $destinationPortId;
        }
        $trip->update($updates);

        $checkpoint = TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => EventType::SHIP_DEPARTED,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => Source::GPS,
            'recorded_at' => now(),
        ]);

        return $this->success([
            'checkpoint' => new TripCheckpointResource($checkpoint),
            'trip_status' => $trip->status,
        ], 'Ship departure recorded');
    }

    protected function recordArrival(Trip $trip, string $eventType, float $latitude, float $longitude)
    {
        $trip->loadMissing(['originCompany', 'originPort', 'destinationCompany', 'destinationPort', 'shipDestinationPort']);

        // Which arrival event_type is valid, what point it must be near, and what happens
        // on success, all depend on the trip's current status (PRD Bagian 16 state chains)
        // and whether it's cross-border (PRD Bagian 5.1: destination_port_id is the truck's
        // own-country port, never the ship's final one, so it's still the right target here).
        [$expectedEventType, $target, $onSuccess] = match (true) {
            $trip->status === StatusTrips::IN_TRANSIT_ORIGIN && $trip->ship_destination_port_id !== null => [
                EventType::ARRIVED_AT_PORT,
                $this->resolvePoint($trip, 'destination'),
                fn () => ['status' => StatusTrips::AT_ORIGIN_PORT],
            ],
            $trip->status === StatusTrips::IN_TRANSIT_ORIGIN => [
                EventType::ARRIVED_AT_DESTINATION,
                $this->resolvePoint($trip, 'destination'),
                fn () => $this->needsReturnLeg($trip)
                    ? ['status' => StatusTrips::ARRIVED]
                    : ['status' => StatusTrips::COMPLETED, 'actual_arrival_at' => now()],
            ],
            $trip->status === StatusTrips::IN_TRANSIT_DESTINATION => [
                EventType::ARRIVED_FINAL,
                $this->resolvePoint($trip, 'origin'),
                fn () => ['status' => StatusTrips::COMPLETED, 'actual_arrival_at' => now()],
            ],
            // Cross-border truck home again. Sets truck_returned_at only, not `status`
            // or actual_arrival_at, those belong to the ship's own eventual completion.
            $trip->status === StatusTrips::AT_ORIGIN_PORT => [
                EventType::TRUCK_RETURNED,
                $this->resolvePoint($trip, 'origin'),
                fn () => ['truck_returned_at' => now()],
            ],
            // Mirrors TripController::markShipArrived() (the real VesselAPI-poll-driven
            // path) — target is ship_destination_port, which recordShipDeparture() may
            // have just overwritten with Simulate Vessel's randomly-picked destination.
            // Goes straight to completed: cross-border trips have no leg beyond the ship
            // reaching the destination port (no destination-side company in the combo).
            $trip->status === StatusTrips::ON_SHIP => [
                EventType::SHIP_ARRIVED,
                [
                    'lat' => (float) $trip->shipDestinationPort?->latitude,
                    'lng' => (float) $trip->shipDestinationPort?->longitude,
                ],
                fn () => ['status' => StatusTrips::COMPLETED, 'actual_arrival_at' => now()],
            ],
            default => [null, null, null],
        };

        if ($expectedEventType === null) {
            return $this->error('Trip is not currently awaiting arrival confirmation.', 422);
        }

        if ($eventType !== $expectedEventType) {
            return $this->error("event_type must be '{$expectedEventType}' for current trip status.", 422);
        }

        $distanceMeters = $this->haversineDistanceMeters($latitude, $longitude, $target['lat'], $target['lng']);

        if ($distanceMeters > self::ARRIVAL_RADIUS_METERS) {
            Notification::create([
                'user_id' => $trip->created_by,
                'trip_id' => $trip->id,
                'type' => NotificationType::LOCATION_VALIDATION_FAILED,
                'message' => "Trip #{$trip->id}: location validation failed (distance {$distanceMeters}m, max radius ".self::ARRIVAL_RADIUS_METERS.'m).',
            ]);

            return $this->error("Location is too far from the destination point (distance {$distanceMeters}m, max radius ".self::ARRIVAL_RADIUS_METERS.'m).', 422);
        }

        $updates = $onSuccess();
        $trip->update($updates);

        $checkpoint = TripCheckpoint::create([
            'trip_id' => $trip->id,
            'event_type' => $eventType,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => Source::GPS,
            'recorded_at' => now(),
        ]);

        Notification::create([
            'user_id' => $trip->created_by,
            'trip_id' => $trip->id,
            'type' => NotificationType::ARRIVED_AT_POINT,
            'message' => "Trip #{$trip->id} arrived at point {$eventType}.",
        ]);

        if (($updates['status'] ?? null) === StatusTrips::COMPLETED) {
            Notification::create([
                'user_id' => $trip->created_by,
                'trip_id' => $trip->id,
                'type' => NotificationType::TRIP_COMPLETED,
                'message' => "Trip #{$trip->id} has completed.",
            ]);
        }

        return $this->success([
            'checkpoint' => new TripCheckpointResource($checkpoint),
            'trip_status' => $trip->status,
        ], 'Arrival validated');
    }
}
