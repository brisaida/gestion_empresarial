<?php

namespace App\Services;

use App\Models\Empresa;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

/**
 * Autorización de documentos (requisiciones, cotizaciones) con firma y sello
 * de la empresa. Requiere el permiso "firmar" y el PIN personal del usuario.
 */
class AutorizacionService
{
    public function autorizar(Model $documento, User $usuario, string $pin): void
    {
        if (! $usuario->tienePermiso($documento->empresa_id, 'firmar')) {
            throw new DomainException('No tienes permiso para autorizar documentos.');
        }
        if ($documento->autorizado_at) {
            throw new DomainException('Este documento ya fue autorizado.');
        }
        if (! $usuario->pin_firma) {
            throw new DomainException('Primero configura tu PIN de autorización (menú de usuario → PIN de autorización).');
        }
        if (! Hash::check($pin, $usuario->pin_firma)) {
            throw new DomainException('PIN incorrecto.');
        }

        $empresa = Empresa::findOrFail($documento->empresa_id);
        if (! $empresa->firma_imagen && ! $empresa->sello_imagen) {
            throw new DomainException('La empresa no tiene firma ni sello cargados. Súbelos en Configuración.');
        }

        $documento->update([
            'autorizado_por' => $usuario->id,
            'autorizado_at'  => now(),
        ]);
    }

    /** Firma, sello y datos de quien autorizó; null si el documento no está autorizado. */
    public function datosFirma(Model $documento): ?array
    {
        if (! $documento->autorizado_at) return null;

        $empresa = Empresa::findOrFail($documento->empresa_id);

        return [
            'firma'          => $empresa->firma_imagen,
            'sello'          => $empresa->sello_imagen,
            'autorizado_por' => $documento->autorizador?->nombre,
            'autorizado_at'  => $documento->autorizado_at->format('d/m/Y H:i'),
        ];
    }
}
