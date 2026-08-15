<?php

namespace App\Http\Requests;

use App\Context\CompanyType;
use App\Context\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCompanyRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only admin can create company records (PRD Bagian 3, 14).
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
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in([CompanyType::INTERNAL, CompanyType::PARTNER])],
            'city' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.in' => 'Company type must be internal or partner.',
            'latitude.between' => 'Latitude coordinate must be between -90 and 90.',
            'longitude.between' => 'Longitude coordinate must be between -180 and 180.',
        ];
    }
}
