<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransferenciaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'         => ['required', 'integer', 'exists:empresas,id'],
            'bodega_origen_id'   => ['required', 'integer', 'exists:bodegas,id', 'different:bodega_destino_id'],
            'bodega_destino_id'  => ['required', 'integer', 'exists:bodegas,id'],
            'fecha_transferencia' => ['required', 'date'],
            'observaciones'      => ['nullable', 'string'],
            'detalles'           => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'       => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.cantidad'          => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.lote'              => ['nullable', 'string', 'max:60'],
            'detalles.*.fecha_vencimiento' => ['nullable', 'date'],
            'detalles.*.numero_serie'      => ['nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'bodega_origen_id.different' => 'La bodega origen y destino no pueden ser la misma.',
        ];
    }
}
