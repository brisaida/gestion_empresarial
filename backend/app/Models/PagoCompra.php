<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class PagoCompra extends Model
{
    use Auditable;

    public function bitacoraDescripcion(): string
    {
        $factura = Compra::whereKey($this->compra_id)->value('numero_factura') ?? "#{$this->compra_id}";
        return 'Pago a proveedor L ' . number_format((float) $this->monto, 2) . " · compra {$factura}";
    }
    protected $table = 'pagos_compra';

    protected $fillable = [
        'empresa_id', 'compra_id', 'proveedor_id', 'usuario_id', 'fecha', 'monto', 'metodo_pago',
        'desde_caja', 'referencia', 'observaciones', 'anulado', 'anulado_por', 'anulado_at',
        'tarjeta_credito_id',
        'cuenta_bancaria_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha'      => 'date',
            'monto'      => 'decimal:2',
            'desde_caja' => 'boolean',
            'anulado'    => 'boolean',
            'anulado_at' => 'datetime',
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

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function tarjeta()
    {
        return $this->belongsTo(TarjetaCredito::class, 'tarjeta_credito_id');
    }
}
