<?php

namespace App\Http\Resources;

use App\Context\EventType;
use App\Context\Source;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'TripCheckpoint',
    description: 'GPS ping or status transition milestone recorded during a trip execution',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1, description: 'Unique identifier of the checkpoint record'),
        new OA\Property(property: 'trip_id', type: 'integer', example: 5, description: 'Associated trip ID'),
        new OA\Property(
            property: 'event_type',
            type: 'string',
            enum: [
                EventType::DEPARTED,
                EventType::GPS_PING,
                EventType::ARRIVED_AT_DESTINATION,
                EventType::ARRIVED_AT_PORT,
                EventType::ARRIVED_FINAL,
                EventType::SHIP_DEPARTED,
                EventType::SHIP_ARRIVED,
                EventType::TRUCK_RETURNED,
            ],
            example: EventType::GPS_PING,
            description: 'Checkpoint event category: gps_ping (every 3s), departed (start leg), arrived_at_destination (confirmed arrival), truck_returned (cross-border truck return)'
        ),
        new OA\Property(property: 'latitude', type: 'number', format: 'float', nullable: true, example: 1.1234567, description: 'GPS latitude coordinate'),
        new OA\Property(property: 'longitude', type: 'number', format: 'float', nullable: true, example: 104.0123456, description: 'GPS longitude coordinate'),
        new OA\Property(property: 'source', type: 'string', enum: [Source::GPS, Source::MANUAL, Source::API], example: Source::GPS, description: 'Data source: gps (browser Geolocation API), manual (user button press), api (VesselAPI/automated system)'),
        new OA\Property(property: 'recorded_at', type: 'string', format: 'date-time', description: 'Timestamp when the checkpoint event was recorded'),
    ],
    type: 'object'
)]
class TripCheckpointResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'event_type' => $this->event_type,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'source' => $this->source,
            'recorded_at' => $this->recorded_at,
        ];
    }
}
