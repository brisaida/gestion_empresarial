<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PagoTarjeta extends Model
{
    protected $table = 'pagos_tarjeta';

    protected $fillable = [
        'empresa_id', 'tarjeta_credito_id', 'usuario_id', 'fecha', 'monto', 'metodo_pago', 'desde_caja',
        'referencia', 'observaciones', 'anulado', 'anulado_por', 'anulado_at',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date', 'monto' => 'decimal:2', 'desde_caja' => 'boolean', 'anulado' => 'boolean', 'anulado_at' => 'datetime'];
    }

    public function tarjeta()
    {
        return $this->belongsTo(TarjetaCredito::class, 'tarjeta_credito_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
