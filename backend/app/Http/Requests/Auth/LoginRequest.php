<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'correo'   => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'correo.required'   => 'El correo es obligatorio.',
            'correo.email'      => 'El correo debe ser un email válido.',
            'password.required' => 'La contraseña es obligatoria.',
        ];
    }
}
