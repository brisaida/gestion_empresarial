<?php

namespace App\Http\Requests\Warehouse;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBodegaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id'],
            'codigo'      => ['nullable', 'string', 'max:30'],
            'nombre'      => ['sometimes', 'required', 'string', 'max:100'],
            'activo'      => ['boolean'],
        ];
    }
}
