<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bitacora extends Model
{
    public $timestamps = false;

    protected $table = 'bitacora';

    protected $fillable = [
        'empresa_id', 'usuario_id', 'modulo', 'accion',
        'descripcion', 'valores_anteriores', 'valores_nuevos',
        'ip', 'fecha',
    ];

    protected function casts(): array
    {
        return [
            'valores_anteriores' => 'array',
            'valores_nuevos'     => 'array',
            'fecha'              => 'datetime',
        ];
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
