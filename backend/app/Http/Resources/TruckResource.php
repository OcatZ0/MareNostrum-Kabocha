<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'Truck',
    description: 'Representation of a logistics fleet truck resource',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1, description: 'Unique identifier of the truck'),
        new OA\Property(property: 'plate_number', type: 'string', example: 'BP 1001 XY', description: 'License plate number (unique)'),
        new OA\Property(property: 'brand', type: 'string', example: 'Hino', description: 'Brand/Manufacturer used for CO2 emission factor lookup'),
        new OA\Property(property: 'model', type: 'string', nullable: true, example: 'Dutro 110 SD', description: 'Specific truck model'),
        new OA\Property(property: 'year', type: 'integer', example: 2023, description: 'Manufacturing year'),
        new OA\Property(property: 'age_years', type: 'integer', example: 3, description: 'Calculated truck age in years (current year - year)'),
        new OA\Property(property: 'fuel_type', type: 'string', enum: ['diesel', 'petrol', 'electric'], example: 'diesel', description: 'Type of fuel consumed by the truck'),
        new OA\Property(property: 'status', type: 'string', enum: ['active', 'maintenance'], example: 'active', description: 'Operational status: active = available for assignment, maintenance = under repair'),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time', description: 'Timestamp when the record was created'),
        new OA\Property(property: 'updated_at', type: 'string', format: 'date-time', description: 'Timestamp when the record was last updated'),
    ],
    type: 'object'
)]
class TruckResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plate_number' => $this->plate_number,
            'brand' => $this->brand,
            'model' => $this->model,
            'year' => $this->year,
            'age_years' => now()->year - $this->year,
            'fuel_type' => $this->fuel_type,
            'status' => $this->status,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
