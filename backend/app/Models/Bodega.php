<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Bodega extends Model
{
    use HasFactory;

    protected $fillable = [
        'empresa_id', 'sucursal_id', 'codigo', 'nombre', 'activo', 'predeterminada',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean', 'predeterminada' => 'boolean'];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function sucursal()
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function existencias()
    {
        return $this->hasMany(Existencia::class);
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoInventario::class);
    }

    public function compras()
    {
        return $this->hasMany(Compra::class);
    }

    public function ventas()
    {
        return $this->hasMany(Venta::class);
    }
}
