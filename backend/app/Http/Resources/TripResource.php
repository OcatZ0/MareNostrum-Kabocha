<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'TripEndpoint',
    description: 'An origin or destination point — either a company or a port.',
    properties: [
        new OA\Property(property: 'type', type: 'string', enum: ['company', 'port']),
        new OA\Property(property: 'id', type: 'integer'),
        new OA\Property(property: 'name', type: 'string'),
    ],
    type: 'object'
)]
#[OA\Schema(
    schema: 'Trip',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'origin', ref: '#/components/schemas/TripEndpoint'),
        new OA\Property(property: 'destination', ref: '#/components/schemas/TripEndpoint'),
        new OA\Property(property: 'ship_destination_port', ref: '#/components/schemas/TripEndpoint', nullable: true),
        new OA\Property(property: 'truck_id', type: 'integer', nullable: true),
        new OA\Property(property: 'driver_id', type: 'integer', nullable: true),
        new OA\Property(property: 'ship_ref_id', type: 'string', nullable: true),
        new OA\Property(property: 'recommended_slots', type: 'object', nullable: true),
        new OA\Property(property: 'route_geometry', type: 'object', nullable: true),
        new OA\Property(property: 'chosen_departure_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(
            property: 'status',
            type: 'string',
            enum: ['draft', 'assigned', 'in_transit_origin', 'at_origin_port', 'on_ship', 'at_destination_port', 'in_transit_destination', 'arrived', 'completed', 'cancelled'],
            example: 'draft'
        ),
        new OA\Property(property: 'distance_km', type: 'number', format: 'float', nullable: true),
        new OA\Property(property: 'estimated_co2_kg', type: 'number', format: 'float', nullable: true),
        new OA\Property(property: 'estimated_duration_min', type: 'integer', nullable: true),
        new OA\Property(property: 'actual_departure_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'actual_arrival_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'created_by', type: 'integer'),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
        new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
    ],
    type: 'object'
)]
class TripResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'origin' => $this->when(
                $this->origin_company_id || $this->origin_port_id,
                fn () => $this->origin_company_id
                    ? ['type' => 'company', 'id' => $this->origin_company_id, 'name' => $this->originCompany?->name]
                    : ['type' => 'port', 'id' => $this->origin_port_id, 'name' => $this->originPort?->name]
            ),
            'destination' => $this->when(
                $this->destination_company_id || $this->destination_port_id,
                fn () => $this->destination_company_id
                    ? ['type' => 'company', 'id' => $this->destination_company_id, 'name' => $this->destinationCompany?->name]
                    : ['type' => 'port', 'id' => $this->destination_port_id, 'name' => $this->destinationPort?->name]
            ),
            'ship_destination_port' => $this->when(
                (bool) $this->ship_destination_port_id,
                fn () => ['id' => $this->ship_destination_port_id, 'name' => $this->shipDestinationPort?->name]
            ),
            'truck_id' => $this->truck_id,
            'driver_id' => $this->driver_id,
            'ship_ref_id' => $this->ship_ref_id,
            'recommended_slots' => $this->recommended_slots,
            'route_geometry' => $this->route_geometry,
            'chosen_departure_at' => $this->chosen_departure_at,
            'status' => $this->status,
            'distance_km' => $this->distance_km,
            'estimated_co2_kg' => $this->estimated_co2_kg,
            'estimated_duration_min' => $this->estimated_duration_min,
            'actual_departure_at' => $this->actual_departure_at,
            'actual_arrival_at' => $this->actual_arrival_at,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
