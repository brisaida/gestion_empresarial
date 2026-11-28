<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class Receta extends Model
{
    use Auditable;
    protected $fillable = [
        'empresa_id', 'nombre', 'descripcion', 'precio_venta', 'activo',
    ];

    protected function casts(): array
    {
        return [
            'precio_venta' => 'decimal:4',
            'activo'       => 'boolean',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function ingredientes()
    {
        return $this->hasMany(RecetaIngrediente::class);
    }
}
