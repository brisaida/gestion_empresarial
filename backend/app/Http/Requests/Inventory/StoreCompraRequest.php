<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class StoreCompraRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'     => ['required', 'integer', 'exists:empresas,id'],
            'proveedor_id'   => ['required', 'integer', 'exists:proveedores,id'],
            'bodega_id'      => ['required', 'integer', 'exists:bodegas,id'],
            'numero_factura' => ['nullable', 'string', 'max:60'],
            'fecha_compra'   => ['required', 'date'],
            'descuento'      => ['nullable', 'numeric', 'min:0'],
            'impuesto'       => ['nullable', 'numeric', 'min:0'],
            'detalles'       => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'       => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.cantidad'          => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.costo_unitario'    => ['required', 'numeric', 'min:0'],
            'detalles.*.lote'              => ['nullable', 'string', 'max:60'],
            'detalles.*.fecha_vencimiento' => ['nullable', 'date'],
        ];
    }
}
