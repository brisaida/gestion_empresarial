<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cotizacion extends Model
{
    protected $table = 'cotizaciones';

    protected $fillable = [
        'empresa_id', 'cliente_id', 'usuario_id', 'venta_id',
        'numero_cotizacion', 'fecha_cotizacion', 'fecha_vencimiento',
        'observaciones', 'subtotal', 'descuento', 'impuesto', 'total', 'estado',
    ];

    protected function casts(): array
    {
        return [
            'fecha_cotizacion'  => 'date',
            'fecha_vencimiento' => 'date',
            'subtotal'          => 'decimal:4',
            'descuento'         => 'decimal:4',
            'impuesto'          => 'decimal:4',
            'total'             => 'decimal:4',
        ];
    }

    public function empresa()    { return $this->belongsTo(Empresa::class); }
    public function cliente()    { return $this->belongsTo(Cliente::class); }
    public function usuario()    { return $this->belongsTo(Usuario::class); }
    public function venta()      { return $this->belongsTo(Venta::class); }
    public function detalles()   { return $this->hasMany(DetalleCotizacion::class); }
}
