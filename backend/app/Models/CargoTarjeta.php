<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class CargoTarjeta extends Model
{
    use Auditable;

    /** Bitácora: solo los cargos manuales (los demás vienen de requisiciones, compras o pagos) */
    public function bitacoraDebeRegistrar(string $evento): bool
    {
        return $this->origen === 'manual';
    }

    protected $table = 'cargos_tarjeta';

    protected $fillable = [
        'empresa_id', 'tarjeta_credito_id', 'usuario_id', 'fecha', 'monto', 'descripcion', 'origen',
        'requisicion_id', 'compra_id', 'pago_compra_id', 'devolucion_compra_id', 'anulado',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date', 'monto' => 'decimal:2', 'anulado' => 'boolean'];
    }

    public function tarjeta()
    {
        return $this->belongsTo(TarjetaCredito::class, 'tarjeta_credito_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function requisicion()
    {
        return $this->belongsTo(Requisicion::class);
    }

    public function compra()
    {
        return $this->belongsTo(Compra::class);
    }
}
