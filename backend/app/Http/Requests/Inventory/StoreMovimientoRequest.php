<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMovimientoRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'      => ['required', 'integer', 'exists:empresas,id'],
            'bodega_id'       => ['required', 'integer', 'exists:bodegas,id'],
            'tipo_movimiento' => ['required', Rule::in(['entrada', 'salida', 'ajuste_positivo', 'ajuste_negativo'])],
            'numero_documento' => ['nullable', 'string', 'max:60'],
            'fecha'           => ['required', 'date'],
            'observaciones'   => ['nullable', 'string'],
            'detalles'        => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'    => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.cantidad'       => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.costo_unitario' => ['nullable', 'numeric', 'min:0'],
            'detalles.*.lote'           => ['nullable', 'string', 'max:60'],
            'detalles.*.fecha_vencimiento' => ['nullable', 'date'],
            'detalles.*.numero_serie'   => ['nullable', 'string', 'max:100'],
        ];
    }
}
