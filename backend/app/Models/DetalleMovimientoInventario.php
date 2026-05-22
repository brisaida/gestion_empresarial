<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleMovimientoInventario extends Model
{
    protected $table = 'detalle_movimientos_inventario';

    protected $fillable = [
        'movimiento_inventario_id', 'producto_id',
        'lote', 'fecha_vencimiento', 'numero_serie',
        'cantidad', 'costo_unitario', 'costo_total',
    ];

    protected function casts(): array
    {
        return [
            'fecha_vencimiento' => 'date',
            'cantidad'          => 'decimal:4',
            'costo_unitario'    => 'decimal:4',
            'costo_total'       => 'decimal:4',
        ];
    }

    public function movimiento()
    {
        return $this->belongsTo(MovimientoInventario::class, 'movimiento_inventario_id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }
}
