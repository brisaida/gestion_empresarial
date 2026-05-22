<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Venta extends Model
{
    use HasFactory;

    protected $fillable = [
        'empresa_id', 'cliente_id', 'bodega_id', 'usuario_id',
        'numero_factura', 'fecha_venta',
        'subtotal', 'impuesto', 'descuento', 'total', 'estado',
    ];

    protected function casts(): array
    {
        return [
            'fecha_venta' => 'date',
            'subtotal'    => 'decimal:4',
            'impuesto'    => 'decimal:4',
            'descuento'   => 'decimal:4',
            'total'       => 'decimal:4',
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
