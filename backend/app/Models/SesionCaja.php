<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SesionCaja extends Model
{
    protected $table = 'sesiones_caja';

    protected $fillable = [
        'empresa_id', 'usuario_id', 'monto_inicial', 'monto_cierre',
        'diferencia', 'total_ventas', 'total_efectivo', 'total_tarjeta',
        'total_transferencia', 'total_mixto', 'cantidad_ventas',
        'estado', 'fecha_apertura', 'fecha_cierre', 'observaciones',
        'total_credito', 'total_abonos', 'total_abonos_efectivo', 'total_pagos_proveedores',
        'total_reembolsos_clientes', 'total_reembolsos_proveedores',
        'total_pagos_tarjetas', 'total_depositos_banco',
    ];

    protected $casts = [
        'fecha_apertura' => 'datetime',
        'fecha_cierre'   => 'datetime',
    ];

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
