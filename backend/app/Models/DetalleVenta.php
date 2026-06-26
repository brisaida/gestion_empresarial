<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleVenta extends Model
{
    protected $table = 'detalle_ventas';

    protected $fillable = [
        'venta_id', 'producto_id', 'receta_id',
        'cantidad', 'precio_unitario', 'costo_unitario', 'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'        => 'decimal:4',
            'precio_unitario' => 'decimal:4',
            'costo_unitario'  => 'decimal:4',
            'subtotal'        => 'decimal:4',
        ];
    }

    public function venta()
    {
        return $this->belongsTo(Venta::class);
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }

    public function receta()
    {
        return $this->belongsTo(Receta::class);
    }
}
