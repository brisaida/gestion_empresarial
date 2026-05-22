<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleCompra extends Model
{
    protected $table = 'detalle_compras';

    protected $fillable = [
        'compra_id', 'producto_id',
        'cantidad', 'costo_unitario', 'subtotal',
        'lote', 'fecha_vencimiento',
    ];

    protected function casts(): array
    {
        return [
            'fecha_vencimiento' => 'date',
            'cantidad'          => 'decimal:4',
            'costo_unitario'    => 'decimal:4',
            'subtotal'          => 'decimal:4',
        ];
    }

    public function compra()
    {
        return $this->belongsTo(Compra::class);
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }
}
