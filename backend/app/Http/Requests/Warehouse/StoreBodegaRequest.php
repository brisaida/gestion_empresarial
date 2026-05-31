<?php

namespace App\Http\Requests\Warehouse;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBodegaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'  => ['required', 'integer', 'exists:empresas,id'],
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id'],
            'codigo'      => [
                'nullable', 'string', 'max:30',
                Rule::unique('bodegas')->where('empresa_id', $this->empresa_id),
            ],
            'nombre'      => ['required', 'string', 'max:100'],
            'activo'      => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'codigo.unique' => 'Ya existe una bodega con ese código en esta empresa.',
        ];
    }
}
