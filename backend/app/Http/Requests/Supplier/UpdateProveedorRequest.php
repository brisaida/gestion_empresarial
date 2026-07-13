<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProveedorRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'nombre'    => ['sometimes', 'required', 'string', 'max:200'],
            'rtn'       => ['nullable', 'string', 'max:30'],
            'correo'    => ['nullable', 'email', 'max:100'],
            'telefono'  => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:255'],
            'departamento' => ['nullable', 'string', 'max:100'],
            'municipio'    => ['nullable', 'string', 'max:100'],
            'activo'       => ['boolean'],
        ];
    }
}
