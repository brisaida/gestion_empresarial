<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleDevolucionCompra extends Model
{
    protected $table = 'detalle_devoluciones_compra';

    protected $fillable = [
        'devolucion_compra_id', 'detalle_compra_id', 'producto_id', 'cantidad', 'costo_unitario', 'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'       => 'decimal:4',
            'costo_unitario' => 'decimal:4',
            'subtotal'       => 'decimal:4',
        ];
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }
}
