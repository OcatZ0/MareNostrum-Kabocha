<?php

namespace App\Http\Requests;

use App\Context\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only admin can manage users (PRD Bagian 3, 14).
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
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'string', Rule::in([Role::ADMIN, Role::DRIVER])],
            'phone' => ['nullable', 'string', 'max:20'],
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
            'username.unique' => 'Username ini sudah digunakan oleh akun lain.',
            'username.alpha_dash' => 'Username hanya boleh berisi huruf, angka, tanda hubung (-), dan garis bawah (_).',
            'password.min' => 'Password minimal harus 6 karakter.',
            'role.in' => 'Role harus bernilai admin atau driver.',
        ];
    }
}
