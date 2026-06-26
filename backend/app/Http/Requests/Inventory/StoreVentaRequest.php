<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class StoreVentaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'     => ['required', 'integer', 'exists:empresas,id'],
            'cliente_id'     => ['nullable', 'integer', 'exists:clientes,id'],
            'bodega_id'      => ['required', 'integer', 'exists:bodegas,id'],
            'numero_factura' => ['nullable', 'string', 'max:60'],
            'fecha_venta'    => ['required', 'date'],
            'descuento'      => ['nullable', 'numeric', 'min:0'],
            'impuesto'       => ['nullable', 'numeric', 'min:0'],
            'detalles'       => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'      => ['nullable', 'integer', 'exists:productos,id'],
            'detalles.*.receta_id'        => ['nullable', 'integer', 'exists:recetas,id'],
            'detalles.*.cantidad'         => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.precio_unitario'  => ['required', 'numeric', 'min:0'],
        ];
    }
}
