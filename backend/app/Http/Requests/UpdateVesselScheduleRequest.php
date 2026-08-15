<?php

namespace App\Http\Requests;

use App\Context\Role;
use App\Context\VesselScheduleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVesselScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    public function rules(): array
    {
        return [
            'vessel_name' => ['sometimes', 'required', 'string', 'max:150'],
            'ship_ref_id' => ['sometimes', 'required', 'string', 'max:30'],
            'voyage_number' => ['nullable', 'string', 'max:50'],
            'origin_port_id' => ['sometimes', 'required', 'integer', 'exists:ports,id'],
            'destination_port_id' => ['sometimes', 'required', 'integer', 'exists:ports,id'],
            'scheduled_departure_at' => ['sometimes', 'required', 'date'],
            'scheduled_arrival_at' => ['sometimes', 'required', 'date'],
            'actual_departure_at' => ['nullable', 'date'],
            'actual_arrival_at' => ['nullable', 'date'],
            'estimated_arrival_at' => ['nullable', 'date'],
            'status' => ['sometimes', 'required', 'string', Rule::in(VesselScheduleStatus::all())],
            'current_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'current_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'current_speed_knots' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tolerance_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'status.in' => 'Invalid vessel schedule status.',
            'origin_port_id.exists' => 'Selected origin port does not exist.',
            'destination_port_id.exists' => 'Selected destination port does not exist.',
        ];
    }
}
