<?php

namespace App\Http\Requests;

use App\Context\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ShipTripRequest extends FormRequest
{
    /**
     * Only admin can set/update a trip's ship reference id (PRD Bagian 5.1 step 6, 14).
     */
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'vessel_schedule_id' => ['nullable', 'integer', 'exists:vessel_schedules,id'],
            'ship_ref_id' => ['required_without:vessel_schedule_id', 'nullable', 'string', 'regex:/^(\d{9}|(IMO)?\d{7})$/i'],
        ];
    }

    public function messages(): array
    {
        return [
            'ship_ref_id.regex' => 'ship_ref_id must be MMSI (9 digits) or IMO (7 digits, optionally prefixed with "IMO").',
            'ship_ref_id.required_without' => 'Either ship_ref_id or vessel_schedule_id is required.',
        ];
    }
}
