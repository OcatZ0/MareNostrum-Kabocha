<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SimulateTripRequest extends FormRequest
{
    /**
     * Only admin can simulate a custom departure time (PRD Bagian 5.1, 14).
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
            'departure_at' => ['required', 'date', 'after:now'],
        ];
    }
}
