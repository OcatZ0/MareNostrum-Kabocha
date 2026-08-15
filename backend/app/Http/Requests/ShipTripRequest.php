<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ShipTripRequest extends FormRequest
{
    /**
     * Only admin can set/update a trip's ship reference id (PRD Bagian 5.1 step 6, 14).
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // MMSI: 9 digits. IMO: 7 digits, optionally prefixed "IMO" (PRD Bagian 5.1/7: "MMSI/IMO").
            'ship_ref_id' => ['required', 'string', 'regex:/^(\d{9}|(IMO)?\d{7})$/i'],
        ];
    }

    public function messages(): array
    {
        return [
            'ship_ref_id.regex' => 'ship_ref_id harus berupa MMSI (9 digit) atau IMO (7 digit, boleh diawali "IMO").',
        ];
    }
}
