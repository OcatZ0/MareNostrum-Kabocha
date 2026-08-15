<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
