<?php

namespace App\Http\Requests;

use App\Context\Role;
use App\Context\VesselScheduleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVesselScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    public function rules(): array
    {
        return [
            'vessel_name' => ['required', 'string', 'max:150'],
            'ship_ref_id' => ['required', 'string', 'max:30'],
            'voyage_number' => ['nullable', 'string', 'max:50'],
            'origin_port_id' => ['required', 'integer', 'exists:ports,id'],
            'destination_port_id' => ['required', 'integer', 'exists:ports,id', 'different:origin_port_id'],
            'scheduled_departure_at' => ['required', 'date'],
            'scheduled_arrival_at' => ['required', 'date', 'after:scheduled_departure_at'],
            'actual_departure_at' => ['nullable', 'date'],
            'actual_arrival_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(VesselScheduleStatus::all())],
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
            'vessel_name.required' => 'Vessel name is required.',
            'ship_ref_id.required' => 'Ship MMSI / IMO reference is required.',
            'origin_port_id.required' => 'Origin port is required.',
            'origin_port_id.exists' => 'Selected origin port does not exist.',
            'destination_port_id.required' => 'Destination port is required.',
            'destination_port_id.exists' => 'Selected destination port does not exist.',
            'destination_port_id.different' => 'Destination port must be different from origin port.',
            'scheduled_departure_at.required' => 'Scheduled departure time is required.',
            'scheduled_arrival_at.required' => 'Scheduled arrival time is required.',
            'scheduled_arrival_at.after' => 'Scheduled arrival time must be after scheduled departure time.',
            'status.in' => 'Invalid vessel schedule status.',
        ];
    }
}
