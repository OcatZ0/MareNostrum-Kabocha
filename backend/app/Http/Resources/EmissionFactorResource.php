<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'EmissionFactor',
    description: 'CO2 emission factor reference representation based on truck category and age bracket',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1, description: 'Unique identifier of the emission factor entry'),
        new OA\Property(property: 'truck_category', type: 'string', enum: ['light', 'medium', 'heavy'], example: 'medium', description: 'Truck category grouping (light, medium, heavy) based on truck brand & size'),
        new OA\Property(property: 'age_min_year', type: 'integer', example: 0, description: 'Minimum age of truck in years for this factor tier'),
        new OA\Property(property: 'age_max_year', type: 'integer', nullable: true, example: 5, description: 'Maximum age of truck in years (null means no upper age limit)'),
        new OA\Property(property: 'factor_kg_per_km', type: 'number', format: 'float', example: 0.55, description: 'CO2 emission factor in kg CO2 per km traveled'),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time', description: 'Timestamp when the record was created'),
        new OA\Property(property: 'updated_at', type: 'string', format: 'date-time', description: 'Timestamp when the record was last updated'),
    ],
    type: 'object'
)]
class EmissionFactorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'truck_category' => $this->truck_category,
            'age_min_year' => $this->age_min_year,
            'age_max_year' => $this->age_max_year,
            'factor_kg_per_km' => (float) $this->factor_kg_per_km,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
