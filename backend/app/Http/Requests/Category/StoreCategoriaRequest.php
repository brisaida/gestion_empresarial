<?php

namespace App\Http\Requests\Category;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCategoriaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'empresa_id'  => ['required', 'integer', 'exists:empresas,id'],
            'nombre'      => ['required', 'string', 'max:100', Rule::unique('categorias')->where('empresa_id', $this->empresa_id)],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'activo'      => ['boolean'],
        ];
    }
}
