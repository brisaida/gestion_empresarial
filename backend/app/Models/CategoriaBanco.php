<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class CategoriaBanco extends Model
{
    use Auditable;
    protected $table = 'categorias_banco';

    protected $fillable = ['empresa_id', 'nombre', 'tipo', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }
}
