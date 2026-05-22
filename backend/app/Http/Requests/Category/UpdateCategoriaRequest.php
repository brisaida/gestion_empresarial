<?php

namespace App\Http\Requests\Category;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoriaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $categoria = $this->route('categoria');
        return [
            'nombre'      => ['sometimes', 'required', 'string', 'max:100', Rule::unique('categorias')->where('empresa_id', $categoria->empresa_id)->ignore($categoria)],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'activo'      => ['boolean'],
        ];
    }
}
