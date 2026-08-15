<?php

namespace App\Http\Requests;

use App\Context\Country;
use App\Context\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePortRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only admin can update port records (PRD Bagian 3, 14).
     */
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'country' => ['sometimes', 'required', 'string', Rule::in([Country::INDONESIA, Country::SINGAPORE])],
            'unlocode' => ['nullable', 'string', 'size:5', 'alpha_num'],
            'latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('unlocode') && is_string($this->unlocode)) {
            $this->merge([
                'unlocode' => strtoupper(trim($this->unlocode)),
            ]);
        }
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'country.in' => 'Country must be indonesia or singapore.',
            'unlocode.size' => 'UN/LOCODE must be exactly 5 characters (e.g. IDBTH, SGSIN).',
            'latitude.between' => 'Latitude coordinate must be between -90 and 90.',
            'longitude.between' => 'Longitude coordinate must be between -180 and 180.',
        ];
    }
}
