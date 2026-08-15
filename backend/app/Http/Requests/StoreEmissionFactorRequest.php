<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEmissionFactorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'truck_category' => ['required', 'string', 'max:50'],
            'age_min_year' => ['required', 'integer', 'min:0'],
            'age_max_year' => ['nullable', 'integer', 'gte:age_min_year'],
            'factor_kg_per_km' => ['required', 'numeric', 'min:0', 'max:99.9999'],
        ];
    }
}
