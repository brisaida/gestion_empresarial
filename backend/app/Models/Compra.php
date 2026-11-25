<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Compra extends Model
{
    use HasFactory;

    protected $fillable = [
        'empresa_id', 'proveedor_id', 'bodega_id', 'usuario_id',
        'numero_factura', 'fecha_compra',
        'subtotal', 'impuesto', 'descuento', 'costo_envio', 'total', 'estado',
        'condicion', 'metodo_pago', 'dias_credito', 'fecha_vencimiento', 'saldo_pendiente',
        'monto_devuelto', 'devuelto_a_saldo', 'cancelada_por', 'cancelada_at', 'motivo_cancelacion',
        'tarjeta_credito_id', 'requisicion_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha_compra' => 'date',
            'subtotal'     => 'decimal:4',
            'impuesto'     => 'decimal:4',
            'descuento'    => 'decimal:4',
            'total'        => 'decimal:4',
            'costo_envio'  => 'decimal:4',
            'fecha_vencimiento' => 'date',
            'saldo_pendiente'   => 'decimal:4',
            'monto_devuelto'    => 'decimal:4',
            'devuelto_a_saldo'  => 'decimal:4',
            'cancelada_at'      => 'datetime',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
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
        return $this->hasMany(DetalleCompra::class);
    }

    public function pagos()
    {
        return $this->hasMany(PagoCompra::class);
    }

    public function esCredito(): bool
    {
        return $this->condicion === 'credito';
    }

    /** Compras al crédito con saldo y sin cancelar. */
    public function scopeCreditoPendiente($query)
    {
        return $query->where('condicion', 'credito')
            ->where('estado', '!=', 'cancelada')
            ->where('saldo_pendiente', '>', 0.004);
    }

    /** pagada · pendiente · vencida (solo crédito; null en contado). */
    public function estadoPago(): ?string
    {
        if (! $this->esCredito()) return null;
        if ($this->estado === 'cancelada') return 'cancelada';
        if ((float) $this->saldo_pendiente <= 0.004) return 'pagada';
        return $this->fecha_vencimiento && $this->fecha_vencimiento->lt(today()) ? 'vencida' : 'pendiente';
    }

    public function devoluciones()
    {
        return $this->hasMany(DevolucionCompra::class);
    }

    public function canceladaPor()
    {
        return $this->belongsTo(User::class, 'cancelada_por');
    }

    public function tarjeta()
    {
        return $this->belongsTo(TarjetaCredito::class, 'tarjeta_credito_id');
    }

    public function requisicion()
    {
        return $this->belongsTo(Requisicion::class);
    }
}
