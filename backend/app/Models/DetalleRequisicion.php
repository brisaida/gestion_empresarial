<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleRequisicion extends Model
{
    protected $table = 'detalle_requisiciones';

    protected $fillable = [
        'requisicion_id', 'producto_id', 'codigo', 'descripcion', 'cantidad',
        'precio_unitario', 'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'        => 'decimal:4',
            'precio_unitario' => 'decimal:4',
            'subtotal'        => 'decimal:4',
        ];
    }

    public function requisicion() { return $this->belongsTo(Requisicion::class); }
    public function producto()    { return $this->belongsTo(Producto::class); }
}
