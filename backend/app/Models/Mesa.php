<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mesa extends Model
{
    protected $fillable = ['empresa_id', 'nombre', 'capacidad', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function empresa()  { return $this->belongsTo(Empresa::class); }
    public function comandas() { return $this->hasMany(Comanda::class); }
}
