<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleTransferencia extends Model
{
    protected $table = 'detalle_transferencias';

    protected $fillable = [
        'transferencia_id', 'producto_id',
        'cantidad', 'lote', 'fecha_vencimiento', 'numero_serie',
    ];

    protected function casts(): array
    {
        return [
            'fecha_vencimiento' => 'date',
            'cantidad'          => 'decimal:4',
        ];
    }

    public function transferencia()
    {
        return $this->belongsTo(Transferencia::class);
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }
}
