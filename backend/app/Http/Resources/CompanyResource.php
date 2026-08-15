<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'Company',
    description: 'Company record details.',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'name', type: 'string', example: 'Company A Logistics'),
        new OA\Property(property: 'type', type: 'string', enum: ['internal', 'partner'], example: 'internal'),
        new OA\Property(property: 'city', type: 'string', example: 'Batam'),
        new OA\Property(property: 'address', type: 'string', nullable: true, example: 'Kawasan Industri Batam Center'),
        new OA\Property(property: 'latitude', type: 'number', format: 'float', example: 1.1234567),
        new OA\Property(property: 'longitude', type: 'number', format: 'float', example: 104.0123456),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time', nullable: true),
        new OA\Property(property: 'updated_at', type: 'string', format: 'date-time', nullable: true),
    ],
    type: 'object'
)]
class CompanyResource extends JsonResource
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
            'type' => $this->type,
            'city' => $this->city,
            'address' => $this->address,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
