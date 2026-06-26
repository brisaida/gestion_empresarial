<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecetaIngrediente extends Model
{
    protected $fillable = ['receta_id', 'producto_id', 'cantidad'];

    protected function casts(): array
    {
        return ['cantidad' => 'decimal:4'];
    }

    public function receta()
    {
        return $this->belongsTo(Receta::class);
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }
}
