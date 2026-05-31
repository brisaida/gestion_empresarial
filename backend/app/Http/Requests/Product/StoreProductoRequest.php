<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductoRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'         => ['required', 'integer', 'exists:empresas,id'],
            'categoria_id'       => ['nullable', 'integer', 'exists:categorias,id'],
            'marca_id'           => ['nullable', 'integer', 'exists:marcas,id'],
            'unidad_medida_id'   => ['nullable', 'integer', 'exists:unidades_medida,id'],
            'codigo'             => ['nullable', 'string', 'max:60', Rule::unique('productos')->where('empresa_id', $this->empresa_id)],
            'codigo_barra'       => ['nullable', 'string', 'max:100'],
            'nombre'             => ['required', 'string', 'max:200'],
            'descripcion'        => ['nullable', 'string'],
            'tamaño'             => ['nullable', 'string', 'max:50'],
            'peso'               => ['nullable', 'numeric', 'min:0'],
            'largo'              => ['nullable', 'numeric', 'min:0'],
            'ancho'              => ['nullable', 'numeric', 'min:0'],
            'alto'               => ['nullable', 'numeric', 'min:0'],
            'costo'              => ['required', 'numeric', 'min:0'],
            'precio_venta'       => ['required', 'numeric', 'min:0'],
            'tasa_isv'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'stock_minimo'       => ['nullable', 'numeric', 'min:0'],
            'maneja_lote'        => ['boolean'],
            'maneja_vencimiento' => ['boolean'],
            'maneja_serie'       => ['boolean'],
            'activo'             => ['boolean'],
        ];
    }
}
