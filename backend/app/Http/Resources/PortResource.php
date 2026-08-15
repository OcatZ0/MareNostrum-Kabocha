<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'Port',
    description: 'Port record details.',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'name', type: 'string', example: 'Batam Centre Ferry Terminal'),
        new OA\Property(property: 'country', type: 'string', enum: ['indonesia', 'singapore'], example: 'indonesia'),
        new OA\Property(property: 'unlocode', type: 'string', nullable: true, example: 'IDBTH'),
        new OA\Property(property: 'latitude', type: 'number', format: 'float', example: 1.1312345),
        new OA\Property(property: 'longitude', type: 'number', format: 'float', example: 104.0532145),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'updated_at', type: 'string', format: 'date-time', nullable: true),
    ],
    type: 'object'
)]
class PortResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'country' => $this->country,
            'unlocode' => $this->unlocode,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
