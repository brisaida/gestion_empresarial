<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UsuarioEmpresa extends Model
{
    protected $table = 'usuarios_empresas';

    protected $fillable = [
        'usuario_id', 'empresa_id', 'rol_id', 'activo',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function empresa()
    {
        return $this->belongsTo(Empresa::class);
    }

    public function rol()
    {
        return $this->belongsTo(Rol::class);
    }
}
