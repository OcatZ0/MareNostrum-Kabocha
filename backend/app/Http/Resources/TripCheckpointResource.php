<?php

namespace App\Http\Resources;

use App\Context\EventType;
use App\Context\Source;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'TripCheckpoint',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'trip_id', type: 'integer'),
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
        ),
        new OA\Property(property: 'latitude', type: 'number', format: 'float', nullable: true),
        new OA\Property(property: 'longitude', type: 'number', format: 'float', nullable: true),
        new OA\Property(property: 'source', type: 'string', enum: [Source::GPS, Source::MANUAL, Source::API]),
        new OA\Property(property: 'recorded_at', type: 'string', format: 'date-time'),
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
