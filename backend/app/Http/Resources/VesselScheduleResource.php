<?php

namespace App\Http\Resources;

use App\Context\VesselScheduleStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'VesselSchedule',
    description: 'Vessel shipping schedule and punctuality tracking record',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'vessel_name', type: 'string', example: 'Batam Fast 18'),
        new OA\Property(property: 'ship_ref_id', type: 'string', example: '563123456'),
        new OA\Property(property: 'voyage_number', type: 'string', nullable: true, example: 'BF-2026-081'),
        new OA\Property(property: 'origin_port_id', type: 'integer', example: 1),
        new OA\Property(property: 'destination_port_id', type: 'integer', example: 4),
        new OA\Property(property: 'origin_port', ref: '#/components/schemas/Port', nullable: true),
        new OA\Property(property: 'destination_port', ref: '#/components/schemas/Port', nullable: true),
        new OA\Property(property: 'scheduled_departure_at', type: 'string', format: 'date-time'),
        new OA\Property(property: 'scheduled_arrival_at', type: 'string', format: 'date-time'),
        new OA\Property(property: 'actual_departure_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'actual_arrival_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'estimated_arrival_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'status', type: 'string', enum: [
            VesselScheduleStatus::SCHEDULED,
            VesselScheduleStatus::DEPARTED,
            VesselScheduleStatus::ON_TIME,
            VesselScheduleStatus::DELAYED,
            VesselScheduleStatus::EARLY,
            VesselScheduleStatus::BERTHING,
            VesselScheduleStatus::ARRIVED,
            VesselScheduleStatus::CANCELLED,
        ], example: 'on_time'),
        new OA\Property(property: 'current_latitude', type: 'number', format: 'float', nullable: true, example: 1.1512),
        new OA\Property(property: 'current_longitude', type: 'number', format: 'float', nullable: true, example: 103.9532),
        new OA\Property(property: 'current_speed_knots', type: 'number', format: 'float', nullable: true, example: 18.5),
        new OA\Property(property: 'distance_to_destination_km', type: 'number', format: 'float', nullable: true, example: 14.8),
        new OA\Property(property: 'distance_to_destination_nm', type: 'number', format: 'float', nullable: true, example: 7.99),
        new OA\Property(property: 'variance_minutes', type: 'integer', example: -15, description: 'Positive = delayed, negative = early'),
        new OA\Property(property: 'tolerance_minutes', type: 'integer', example: 30),
        new OA\Property(property: 'punctuality_status', type: 'string', example: 'On Time (ETA within 30m)'),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
        new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
    ],
    type: 'object'
)]
class VesselScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variance = $this->variance_minutes ?? 0;
        $tolerance = $this->tolerance_minutes ?? 30;

        $punctualityStatus = 'Scheduled';
        if ($this->status === VesselScheduleStatus::ARRIVED) {
            $punctualityStatus = 'Arrived at Port';
        } elseif ($this->status === VesselScheduleStatus::BERTHING) {
            $punctualityStatus = 'Berthing at Terminal';
        } elseif ($this->status === VesselScheduleStatus::DELAYED) {
            $punctualityStatus = "Delayed by {$variance} mins";
        } elseif ($this->status === VesselScheduleStatus::EARLY) {
            $abs = abs($variance);
            $punctualityStatus = "Early Arrival by {$abs} mins";
        } elseif ($this->status === VesselScheduleStatus::ON_TIME || $this->status === VesselScheduleStatus::DEPARTED) {
            $punctualityStatus = 'On Time';
        } elseif ($this->status === VesselScheduleStatus::CANCELLED) {
            $punctualityStatus = 'Cancelled';
        }

        return [
            'id' => $this->id,
            'vessel_name' => $this->vessel_name,
            'ship_ref_id' => $this->ship_ref_id,
            'voyage_number' => $this->voyage_number,
            'origin_port_id' => $this->origin_port_id,
            'destination_port_id' => $this->destination_port_id,
            'origin_port' => new PortResource($this->whenLoaded('originPort')),
            'destination_port' => new PortResource($this->whenLoaded('destinationPort')),
            'scheduled_departure_at' => $this->scheduled_departure_at?->toISOString(),
            'scheduled_arrival_at' => $this->scheduled_arrival_at?->toISOString(),
            'actual_departure_at' => $this->actual_departure_at?->toISOString(),
            'actual_arrival_at' => $this->actual_arrival_at?->toISOString(),
            'estimated_arrival_at' => $this->estimated_arrival_at?->toISOString(),
            'status' => $this->status,
            'current_latitude' => $this->current_latitude !== null ? (float) $this->current_latitude : null,
            'current_longitude' => $this->current_longitude !== null ? (float) $this->current_longitude : null,
            'current_speed_knots' => $this->current_speed_knots !== null ? (float) $this->current_speed_knots : null,
            'distance_to_destination_km' => $this->distance_to_destination_km !== null ? (float) $this->distance_to_destination_km : null,
            'distance_to_destination_nm' => $this->distance_to_destination_nm !== null ? (float) $this->distance_to_destination_nm : null,
            'variance_minutes' => $this->variance_minutes,
            'tolerance_minutes' => $this->tolerance_minutes,
            'punctuality_status' => $punctualityStatus,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
