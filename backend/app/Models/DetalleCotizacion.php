<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleCotizacion extends Model
{
    protected $table = 'detalle_cotizaciones';

    protected $fillable = [
        'cotizacion_id', 'producto_id',
        'cantidad', 'precio_unitario', 'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'        => 'decimal:4',
            'precio_unitario' => 'decimal:4',
            'subtotal'        => 'decimal:4',
        ];
    }

    public function cotizacion() { return $this->belongsTo(Cotizacion::class); }
    public function producto()   { return $this->belongsTo(Producto::class); }
}
