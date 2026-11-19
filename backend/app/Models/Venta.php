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
        'condicion', 'dias_credito', 'fecha_vencimiento', 'saldo_pendiente',
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
            'fecha_vencimiento' => 'date',
            'saldo_pendiente'   => 'decimal:4',
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

    public function abonos()
    {
        return $this->hasMany(AbonoVenta::class);
    }

    public function esCredito(): bool
    {
        return $this->condicion === 'credito';
    }

    /** Ventas al crédito con saldo y sin cancelar. */
    public function scopeCreditoPendiente($query)
    {
        return $query->where('condicion', 'credito')
            ->where('estado', '!=', 'cancelada')
            ->where('saldo_pendiente', '>', 0.004);
    }

    /** pagada · pendiente · vencida (solo ventas al crédito; null en contado). */
    public function estadoPago(): ?string
    {
        if (! $this->esCredito()) return null;
        if ($this->estado === 'cancelada') return 'cancelada';
        if ((float) $this->saldo_pendiente <= 0.004) return 'pagada';
        return $this->fecha_vencimiento && $this->fecha_vencimiento->lt(today()) ? 'vencida' : 'pendiente';
    }
}
