<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Cliente extends Model
{
    use Auditable;
    use HasFactory;

    protected $table = 'clientes';

    protected $fillable = [
        'empresa_id', 'nombre', 'rtn', 'correo',
        'telefono', 'direccion', 'departamento', 'municipio', 'activo',
        'limite_credito', 'dias_credito',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean', 'limite_credito' => 'decimal:2'];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function ventas()
    {
        return $this->hasMany(Venta::class);
    }

    public function abonos()
    {
        return $this->hasMany(AbonoVenta::class);
    }

    /** Saldo total que el cliente debe en ventas al crédito. */
    public function saldoPendiente(): float
    {
        return (float) $this->ventas()->creditoPendiente()->sum('saldo_pendiente');
    }
}
