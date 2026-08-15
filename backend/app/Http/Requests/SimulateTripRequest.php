<?php

namespace App\Http\Requests;

use App\Context\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SimulateTripRequest extends FormRequest
{
    /**
     * Only admin can simulate a custom departure time (PRD Bagian 5.1, 14).
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
            'departure_at' => ['required', 'date', 'after:now'],
        ];
    }
}
