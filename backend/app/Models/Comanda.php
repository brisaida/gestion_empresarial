<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Comanda extends Model
{
    protected $fillable = [
        'empresa_id', 'bodega_id', 'mesa_id', 'numero_comanda',
        'mesa', 'estado', 'observaciones',
    ];

    public function empresa()    { return $this->belongsTo(Empresa::class); }
    public function bodega()     { return $this->belongsTo(Bodega::class); }
    public function mesa_rel()   { return $this->belongsTo(Mesa::class, 'mesa_id'); }
    public function detalles()   { return $this->hasMany(DetalleComanda::class); }
}
