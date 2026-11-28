<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

class UsuarioEmpresa extends Model
{
    use Auditable;

    public function bitacoraDescripcion(): string
    {
        $usuario = User::find($this->usuario_id)?->nombre ?? "usuario #{$this->usuario_id}";
        $rol     = Rol::find($this->rol_id)?->nombre ?? "#{$this->rol_id}";
        return "Acceso de {$usuario} · rol {$rol}";
    }
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
