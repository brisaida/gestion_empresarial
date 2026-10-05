<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Venta extends Model
{
    use HasFactory;

    protected $fillable = [
        'empresa_id', 'cliente_id', 'bodega_id', 'usuario_id',
        'numero_factura', 'cai', 'cai_rango_desde', 'cai_rango_hasta', 'cai_fecha_limite', 'fecha_venta',
        'subtotal', 'impuesto', 'descuento', 'costo_envio', 'total', 'estado', 'metodo_pago',
        'exonerado', 'orden_compra_exenta', 'constancia_exonerado', 'registro_sag',
    ];

    protected function casts(): array
    {
        return [
            'fecha_venta' => 'date',
            'cai_fecha_limite' => 'date',
            'exonerado' => 'boolean',
            'subtotal'    => 'decimal:4',
            'impuesto'    => 'decimal:4',
            'descuento'    => 'decimal:4',
            'costo_envio'  => 'decimal:4',
            'total'        => 'decimal:4',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
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
        return $this->hasMany(DetalleVenta::class);
    }
}
