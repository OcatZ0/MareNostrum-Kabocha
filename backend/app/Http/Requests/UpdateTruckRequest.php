<?php

namespace App\Http\Requests;

use App\Context\FuelType;
use App\Context\Role;
use App\Context\Status;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTruckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    public function rules(): array
    {
        $truckId = $this->route('truck')?->id ?? $this->route('truck');

        return [
            'plate_number' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('trucks', 'plate_number')->ignore($truckId)],
            'brand' => ['sometimes', 'required', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'year' => ['sometimes', 'required', 'integer', 'min:1990', 'max:' . (date('Y') + 1)],
            'fuel_type' => ['sometimes', 'required', 'string', Rule::in([FuelType::DIESEL, FuelType::GASOLINE, FuelType::ELECTRIC])],
            'status' => ['sometimes', 'required', 'string', Rule::in([Status::ACTIVE, Status::MAINTENANCE])],
        ];
    }

    public function messages(): array
    {
        return [
            'plate_number.unique' => 'Nomor plat ini sudah digunakan oleh truk lain.',
            'fuel_type.in' => 'Tipe bahan bakar harus bernilai diesel, gasoline, atau electric.',
            'status.in' => 'Status truk harus bernilai active atau maintenance.',
            'year.min' => 'Tahun truk minimal 1990.',
        ];
    }
}
