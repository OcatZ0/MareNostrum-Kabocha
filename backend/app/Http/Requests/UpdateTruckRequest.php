<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTruckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $truckId = $this->route('truck')?->id ?? $this->route('truck');

        return [
            'plate_number' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('trucks', 'plate_number')->ignore($truckId)],
            'brand' => ['sometimes', 'required', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'year' => ['sometimes', 'required', 'integer', 'min:1990', 'max:' . (date('Y') + 1)],
            'fuel_type' => ['sometimes', 'required', 'in:diesel,petrol,electric'],
            'status' => ['sometimes', 'required', 'in:active,maintenance'],
        ];
    }
}
