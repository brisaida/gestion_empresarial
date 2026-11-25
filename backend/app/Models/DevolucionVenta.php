<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DevolucionVenta extends Model
{
    protected $table = 'devoluciones_venta';

    protected $fillable = [
        'empresa_id', 'venta_id', 'cliente_id', 'bodega_id', 'usuario_id', 'numero', 'fecha', 'motivo',
        'subtotal', 'impuesto', 'total', 'aplicado_a_saldo', 'reembolsado', 'reembolso_metodo', 'desde_caja',
        'cuenta_bancaria_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha'            => 'date',
            'subtotal'         => 'decimal:4',
            'impuesto'         => 'decimal:4',
            'total'            => 'decimal:4',
            'aplicado_a_saldo' => 'decimal:4',
            'reembolsado'      => 'decimal:4',
            'desde_caja'       => 'boolean',
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

    public function bodega()
    {
        return $this->belongsTo(Bodega::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function detalles()
    {
        return $this->hasMany(DetalleDevolucionVenta::class, 'devolucion_venta_id');
    }
}
