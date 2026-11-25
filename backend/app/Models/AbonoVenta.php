<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AbonoVenta extends Model
{
    protected $table = 'abonos_venta';

    protected $fillable = [
        'empresa_id', 'venta_id', 'cliente_id', 'usuario_id', 'fecha', 'monto',
        'metodo_pago', 'referencia', 'observaciones', 'anulado', 'anulado_por', 'anulado_at',
        'cuenta_bancaria_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha'      => 'date',
            'monto'      => 'decimal:2',
            'anulado'    => 'boolean',
            'anulado_at' => 'datetime',
        ];
    }

    public function venta()
    {
        return $this->belongsTo(Venta::class);
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
