<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DevolucionCompra extends Model
{
    protected $table = 'devoluciones_compra';

    protected $fillable = [
        'empresa_id', 'compra_id', 'proveedor_id', 'bodega_id', 'usuario_id', 'numero', 'fecha', 'motivo',
        'subtotal', 'impuesto', 'total', 'aplicado_a_saldo', 'reembolsado', 'reembolso_metodo', 'desde_caja',
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

    public function compra()
    {
        return $this->belongsTo(Compra::class);
    }

    public function proveedor()
    {
        return $this->belongsTo(Proveedor::class);
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
        return $this->hasMany(DetalleDevolucionCompra::class, 'devolucion_compra_id');
    }
}
