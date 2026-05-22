<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Existencia extends Model
{
    protected $fillable = [
        'empresa_id', 'bodega_id', 'producto_id',
        'lote', 'fecha_vencimiento', 'numero_serie',
        'cantidad', 'cantidad_reservada',
    ];

    protected function casts(): array
    {
        return [
            'fecha_vencimiento'  => 'date',
            'cantidad'           => 'decimal:4',
            'cantidad_reservada' => 'decimal:4',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function bodega()
    {
        return $this->belongsTo(Bodega::class);
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }

    public function cantidadDisponible(): float
    {
        return (float) ($this->cantidad - $this->cantidad_reservada);
    }
}
