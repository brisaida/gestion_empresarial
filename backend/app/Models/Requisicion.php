<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Requisicion extends Model
{
    protected $table = 'requisiciones';

    protected $fillable = [
        'empresa_id', 'proveedor_id', 'usuario_id',
        'numero_requisicion', 'fecha_requisicion', 'realizado_por', 'condicion',
        'observaciones', 'subtotal', 'impuesto', 'total', 'estado', 'autorizado_por', 'autorizado_at',
    ];

    protected function casts(): array
    {
        return [
            'fecha_requisicion' => 'date',
            'autorizado_at'     => 'datetime',
            'subtotal'          => 'decimal:4',
            'impuesto'          => 'decimal:4',
            'total'             => 'decimal:4',
        ];
    }

    public function empresa()   { return $this->belongsTo(Empresa::class); }
    public function proveedor() { return $this->belongsTo(Proveedor::class); }
    public function usuario()   { return $this->belongsTo(User::class, 'usuario_id'); }
    public function detalles()  { return $this->hasMany(DetalleRequisicion::class); }
    public function autorizador() { return $this->belongsTo(User::class, 'autorizado_por'); }
}
