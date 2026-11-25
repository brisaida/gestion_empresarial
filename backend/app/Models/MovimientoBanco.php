<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MovimientoBanco extends Model
{
    protected $table = 'movimientos_banco';

    protected $fillable = [
        'empresa_id', 'cuenta_bancaria_id', 'usuario_id', 'fecha', 'tipo', 'monto', 'descripcion', 'origen',
        'referencia', 'categoria_banco_id', 'venta_id', 'abono_venta_id', 'compra_id', 'pago_compra_id',
        'pago_tarjeta_id', 'devolucion_venta_id', 'devolucion_compra_id', 'grupo', 'desde_caja',
        'conciliado', 'conciliado_at', 'anulado',
    ];

    protected function casts(): array
    {
        return [
            'fecha'         => 'date',
            'monto'         => 'decimal:2',
            'desde_caja'    => 'boolean',
            'conciliado'    => 'boolean',
            'conciliado_at' => 'datetime',
            'anulado'       => 'boolean',
        ];
    }

    public function cuenta()
    {
        return $this->belongsTo(CuentaBancaria::class, 'cuenta_bancaria_id');
    }

    public function categoria()
    {
        return $this->belongsTo(CategoriaBanco::class, 'categoria_banco_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
