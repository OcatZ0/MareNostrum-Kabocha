<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'Company',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'name', type: 'string', example: 'Batamindo Industrial Park'),
        new OA\Property(property: 'type', type: 'string', enum: ['internal', 'partner'], example: 'internal'),
        new OA\Property(property: 'city', type: 'string', example: 'Batam'),
        new OA\Property(property: 'address', type: 'string', nullable: true),
        new OA\Property(property: 'latitude', type: 'number', format: 'float', example: 1.065171),
        new OA\Property(property: 'longitude', type: 'number', format: 'float', example: 104.028693),
    ],
    type: 'object'
)]
class CompanyResource extends JsonResource
{
    /**
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
        ];
    }
}
