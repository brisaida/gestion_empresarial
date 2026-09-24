<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductoRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function messages(): array
    {
        return [
            'codigo.unique'       => 'Ya existe otro producto con este código interno.',
            'codigo_barra.unique' => 'Ya existe otro producto con este código de barras.',
            'bodega_id.required'  => 'Seleccioná una bodega para el stock inicial.',
            'bodega_id.exists'    => 'La bodega seleccionada no pertenece a esta empresa.',
        ];
    }

    public function rules(): array
    {
        return [
            'empresa_id'         => ['required', 'integer', 'exists:empresas,id'],
            'categoria_ids'      => ['nullable', 'array'],
            'categoria_ids.*'    => ['integer', 'exists:categorias,id'],
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
            'precio_incluye_isv' => ['boolean'],
            'stock_minimo'       => ['nullable', 'numeric', 'min:0'],
            'maneja_lote'        => ['boolean'],
            'maneja_vencimiento' => ['boolean'],
            'maneja_serie'       => ['boolean'],
            'activo'             => ['boolean'],
            'tipo'               => ['nullable', 'in:venta,ingrediente'],
            'stock_inicial'      => ['nullable', 'numeric', 'min:0'],
            // Stock inicial nunca queda "sin asignar": exige bodega de la misma empresa
            'bodega_id'          => [
                Rule::requiredIf(fn() => (float) $this->input('stock_inicial', 0) > 0),
                'nullable', 'integer',
                Rule::exists('bodegas', 'id')->where('empresa_id', $this->empresa_id),
            ],
        ];
    }
}
