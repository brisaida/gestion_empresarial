<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Transferencia extends Model
{
    use HasFactory;

    protected $fillable = [
        'empresa_id', 'bodega_origen_id', 'bodega_destino_id',
        'usuario_id', 'fecha_transferencia', 'estado', 'observaciones',
    ];

    protected function casts(): array
    {
        return ['fecha_transferencia' => 'date'];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function bodegaOrigen()
    {
        return $this->belongsTo(Bodega::class, 'bodega_origen_id');
    }

    public function bodegaDestino()
    {
        return $this->belongsTo(Bodega::class, 'bodega_destino_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function detalles()
    {
        return $this->hasMany(DetalleTransferencia::class);
    }
}
