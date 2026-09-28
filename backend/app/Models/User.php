<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'usuarios';

    protected $fillable = [
        'nombre',
        'correo',
        'password',
        'activo',
        'es_super_admin',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'pin_firma',
    ];

    protected function casts(): array
    {
        return [
            'correo_verificado_en' => 'datetime',
            'password'             => 'hashed',
            'activo'               => 'boolean',
            'es_super_admin'       => 'boolean',
        ];
    }

    public function empresas()
    {
        return $this->belongsToMany(Empresa::class, 'usuarios_empresas', 'usuario_id', 'empresa_id')
                    ->withPivot('rol_id', 'activo')
                    ->withTimestamps();
    }

    /**
     * ¿Tiene el usuario el módulo indicado en esa empresa?
     * Misma regla que el middleware TienePermiso (modulos null = acceso total).
     */
    public function tienePermiso(int $empresaId, string $modulo): bool
    {
        if ($this->es_super_admin) return true;

        $rolId = $this->empresas()
            ->where('empresa_id', $empresaId)
            ->where('usuarios_empresas.activo', true)
            ->first()?->pivot?->rol_id;
        if (! $rolId) return false;

        $rol = Rol::find($rolId);
        return ! $rol || $rol->modulos === null || in_array($modulo, $rol->modulos);
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoInventario::class, 'usuario_id');
    }
}
