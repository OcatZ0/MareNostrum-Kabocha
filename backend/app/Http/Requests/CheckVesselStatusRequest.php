<?php

namespace App\Http\Requests;

use App\Context\Role;
use Illuminate\Foundation\Http\FormRequest;

class CheckVesselStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN || $this->user()?->role === Role::DRIVER;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'speed_knots' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notify' => ['nullable', 'boolean'],
        ];
    }
}
