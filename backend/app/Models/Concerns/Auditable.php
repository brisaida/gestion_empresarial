<?php

namespace App\Models\Concerns;

use App\Services\BitacoraService;

/**
 * Registra en la bitácora cada vez que el modelo se crea, edita o elimina.
 * El modelo puede definir `bitacoraDebeRegistrar(string $evento): bool` para filtrar.
 * Ojo: los cambios masivos (Modelo::where(...)->update()) no pasan por aquí.
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(fn($m) => app(BitacoraService::class)->auditarModelo($m, 'created'));
        static::updated(fn($m) => app(BitacoraService::class)->auditarModelo($m, 'updated'));
        static::deleted(fn($m) => app(BitacoraService::class)->auditarModelo($m, 'deleted'));
    }
}
