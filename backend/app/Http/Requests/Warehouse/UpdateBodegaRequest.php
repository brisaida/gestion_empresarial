<?php

namespace App\Http\Requests\Warehouse;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBodegaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $bodegaId = $this->route('bodega')?->id;
        $empresaId = $this->route('bodega')?->empresa_id;

        return [
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id'],
            'codigo'      => [
                'nullable', 'string', 'max:30',
                Rule::unique('bodegas')->where('empresa_id', $empresaId)->ignore($bodegaId),
            ],
            'nombre'      => ['sometimes', 'required', 'string', 'max:100'],
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
