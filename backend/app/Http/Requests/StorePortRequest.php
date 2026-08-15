<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePortRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only admin can create port records (PRD Bagian 3, 14).
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
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
            'country' => ['required', 'string', Rule::in(['indonesia', 'singapore'])],
            'unlocode' => ['nullable', 'string', 'size:5', 'alpha_num'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
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
            'country.in' => 'Negara harus bernilai indonesia atau singapore.',
            'unlocode.size' => 'UN/LOCODE harus persis 5 karakter (contoh: IDBTH, SGSIN).',
            'latitude.between' => 'Koordinat latitude harus bernilai antara -90 dan 90.',
            'longitude.between' => 'Koordinat longitude harus bernilai antara -180 dan 180.',
        ];
    }
}
