<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductoRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'categoria_ids'      => ['nullable', 'array'],
            'categoria_ids.*'    => ['integer', 'exists:categorias,id'],
            'marca_id'           => ['nullable', 'integer', 'exists:marcas,id'],
            'unidad_medida_id'   => ['nullable', 'integer', 'exists:unidades_medida,id'],
            'codigo'             => ['nullable', 'string', 'max:60', Rule::unique('productos')->where('empresa_id', $this->route('producto')->empresa_id)->ignore($this->route('producto'))],
            'codigo_barra'       => ['nullable', 'string', 'max:100'],
            'nombre'             => ['sometimes', 'required', 'string', 'max:200'],
            'descripcion'        => ['nullable', 'string'],
            'tamaño'             => ['nullable', 'string', 'max:50'],
            'peso'               => ['nullable', 'numeric', 'min:0'],
            'largo'              => ['nullable', 'numeric', 'min:0'],
            'ancho'              => ['nullable', 'numeric', 'min:0'],
            'alto'               => ['nullable', 'numeric', 'min:0'],
            'costo'              => ['sometimes', 'numeric', 'min:0'],
            'precio_venta'       => ['sometimes', 'numeric', 'min:0'],
            'tasa_isv'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'stock_minimo'       => ['nullable', 'numeric', 'min:0'],
            'maneja_lote'        => ['boolean'],
            'maneja_vencimiento' => ['boolean'],
            'maneja_serie'       => ['boolean'],
            'activo'             => ['boolean'],
            'tipo'               => ['nullable', 'in:venta,ingrediente'],
        ];
    }
}
