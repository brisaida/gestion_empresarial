<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class TarjetaCredito extends Model
{
    use Auditable;
    protected $table = 'tarjetas_credito';

    protected $fillable = ['empresa_id', 'nombre', 'banco', 'ultimos4', 'dia_corte', 'dia_pago', 'limite', 'activo'];

    protected function casts(): array
    {
        return ['limite' => 'decimal:2', 'activo' => 'boolean'];
    }

    public function cargos()
    {
        return $this->hasMany(CargoTarjeta::class);
    }

    public function pagos()
    {
        return $this->hasMany(PagoTarjeta::class);
    }

    /** "BAC Visa Empresarial ••4521" */
    public function etiqueta(): string
    {
        return "{$this->banco} {$this->nombre} ••{$this->ultimos4}";
    }

    public function saldo(): float
    {
        return round((float) $this->cargos()->where('anulado', false)->sum('monto')
            - (float) $this->pagos()->where('anulado', false)->sum('monto'), 2);
    }
}
