<?php

namespace App\Http\Requests\Warehouse;

use Illuminate\Foundation\Http\FormRequest;

class StoreBodegaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'  => ['required', 'integer', 'exists:empresas,id'],
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id'],
            'codigo'      => ['nullable', 'string', 'max:30'],
            'nombre'      => ['required', 'string', 'max:100'],
            'activo'      => ['boolean'],
        ];
    }
}
