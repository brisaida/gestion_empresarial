<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CuentaBancaria extends Model
{
    protected $table = 'cuentas_bancarias';

    protected $fillable = [
        'empresa_id', 'banco', 'nombre', 'tipo', 'ultimos4', 'moneda',
        'saldo_inicial', 'fecha_saldo_inicial', 'comision_pos_pct', 'activo',
    ];

    protected function casts(): array
    {
        return [
            'saldo_inicial'       => 'decimal:2',
            'fecha_saldo_inicial' => 'date',
            'comision_pos_pct'    => 'decimal:2',
            'activo'              => 'boolean',
        ];
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoBanco::class);
    }

    /** "BAC Cuenta operativa ••1234 (USD)" */
    public function etiqueta(): string
    {
        return "{$this->banco} {$this->nombre} ••{$this->ultimos4}" . ($this->moneda !== 'HNL' ? " ({$this->moneda})" : '');
    }

    public function saldo(): float
    {
        $mov = $this->movimientos()->where('anulado', false)
            ->selectRaw("COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END), 0) as s")
            ->value('s');
        return round((float) $this->saldo_inicial + (float) $mov, 2);
    }
}
