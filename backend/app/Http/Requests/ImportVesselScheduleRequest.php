<?php

namespace App\Http\Requests;

use App\Context\Role;
use Illuminate\Foundation\Http\FormRequest;

class ImportVesselScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimes:xlsx,xls,csv,txt',
                'max:10240', // 10MB
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
            'file.mimes' => 'The file must be a file of type: xlsx, xls, csv.',
            'file.max' => 'The file size must not exceed 10MB.',
        ];
    }
}
