<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class MovimientoInventario extends Model
{
    use HasFactory;

    protected $table = 'movimientos_inventario';

    protected $fillable = [
        'empresa_id', 'bodega_id', 'usuario_id',
        'tipo_movimiento', 'tipo_referencia', 'referencia_id',
        'numero_documento', 'fecha', 'observaciones',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
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
        return $this->hasMany(DetalleMovimientoInventario::class, 'movimiento_inventario_id');
    }
}
