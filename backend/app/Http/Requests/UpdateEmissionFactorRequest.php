<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEmissionFactorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'truck_category' => ['sometimes', 'required', 'string', 'max:50'],
            'age_min_year' => ['sometimes', 'required', 'integer', 'min:0'],
            'age_max_year' => ['nullable', 'integer'],
            'factor_kg_per_km' => ['sometimes', 'required', 'numeric', 'min:0', 'max:99.9999'],
        ];
    }
}
