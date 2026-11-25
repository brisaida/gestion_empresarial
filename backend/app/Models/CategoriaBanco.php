<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategoriaBanco extends Model
{
    protected $table = 'categorias_banco';

    protected $fillable = ['empresa_id', 'nombre', 'tipo', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }
}
