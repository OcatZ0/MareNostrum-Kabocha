<?php

namespace App\Http\Requests;

use App\Context\FuelType;
use App\Context\Role;
use App\Context\Status;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTruckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    public function rules(): array
    {
        return [
            'plate_number' => ['required', 'string', 'max:20', 'unique:trucks,plate_number'],
            'brand' => ['required', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'year' => ['required', 'integer', 'min:1990', 'max:' . (date('Y') + 1)],
            'fuel_type' => ['required', 'string', Rule::in([FuelType::DIESEL, FuelType::GASOLINE, FuelType::ELECTRIC])],
            'status' => ['nullable', 'string', Rule::in([Status::ACTIVE, Status::MAINTENANCE])],
        ];
    }

    public function messages(): array
    {
        return [
            'plate_number.unique' => 'This plate number has already been registered.',
            'fuel_type.in' => 'Fuel type must be diesel, gasoline, or electric.',
            'status.in' => 'Truck status must be active or maintenance.',
            'year.min' => 'Truck year must be at least 1990.',
        ];
    }
}
