<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

class StoreProveedorRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
            'nombre'     => ['required', 'string', 'max:200'],
            'rtn'        => ['nullable', 'string', 'max:30'],
            'correo'     => ['nullable', 'email', 'max:100'],
            'telefono'   => ['nullable', 'string', 'max:30'],
            'direccion'  => ['nullable', 'string', 'max:255'],
            'activo'     => ['boolean'],
        ];
    }
}
