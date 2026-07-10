<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetalleComanda extends Model
{
    protected $fillable = [
        'comanda_id', 'producto_id', 'receta_id',
        'nombre_item', 'cantidad', 'precio_unitario',
        'notas', 'listo',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'        => 'decimal:3',
            'precio_unitario' => 'decimal:4',
            'listo'           => 'boolean',
        ];
    }

    public function comanda()  { return $this->belongsTo(Comanda::class); }
    public function producto() { return $this->belongsTo(Producto::class); }
    public function receta()   { return $this->belongsTo(Receta::class); }
}
