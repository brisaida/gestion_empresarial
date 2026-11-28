<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleDevolucionVenta extends Model
{
    protected $table = 'detalle_devoluciones_venta';

    protected $fillable = [
        'devolucion_venta_id', 'detalle_venta_id', 'producto_id', 'descripcion',
        'cantidad', 'precio_unitario', 'subtotal', 'regresa_a_stock',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'        => 'decimal:4',
            'precio_unitario' => 'decimal:4',
            'subtotal'        => 'decimal:4',
            'regresa_a_stock' => 'boolean',
        ];
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }

}
