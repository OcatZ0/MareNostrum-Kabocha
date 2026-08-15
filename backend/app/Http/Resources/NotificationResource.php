<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'Notification',
    description: 'In-app notification resource representation for drivers and admins',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1, description: 'Unique identifier of the notification'),
        new OA\Property(property: 'user_id', type: 'integer', example: 2, description: 'ID of the target user receiving the notification'),
        new OA\Property(property: 'trip_id', type: 'integer', nullable: true, example: 5, description: 'Associated trip ID (null if general notification)'),
        new OA\Property(
            property: 'type',
            type: 'string',
            enum: [
                'trip_assigned',
                'departure_reminder',
                'arrived_at_point',
                'ship_departed',
                'ship_arrived',
                'trip_completed',
                'delay_warning',
                'location_validation_failed'
            ],
            example: 'trip_assigned',
            description: 'Notification trigger type category'
        ),
        new OA\Property(property: 'message', type: 'string', example: 'Anda ditugaskan pada trip #5, keberangkatan 2026-08-15 08:00', description: 'Notification message content'),
        new OA\Property(property: 'is_read', type: 'boolean', example: false, description: 'Read status flag (false = unread, true = read)'),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time', description: 'Timestamp when the notification was generated'),
    ],
    type: 'object'
)]
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'trip_id' => $this->trip_id,
            'type' => $this->type,
            'message' => $this->message,
            'is_read' => (bool) $this->is_read,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
