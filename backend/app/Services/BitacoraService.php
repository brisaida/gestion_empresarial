<?php

namespace App\Services;

use App\Models\Bitacora;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class BitacoraService
{
    public function registrar(
        int $empresaId,
        string $modulo,
        string $accion,
        string $descripcion = '',
        array $anterior = [],
        array $nuevo = []
    ): void {
        Bitacora::create([
            'empresa_id'         => $empresaId,
            'usuario_id'         => Auth::id(),
            'modulo'             => $modulo,
            'accion'             => $accion,
            'descripcion'        => $descripcion,
            'valores_anteriores' => $anterior ?: null,
            'valores_nuevos'     => $nuevo ?: null,
            'ip'                 => Request::ip(),
        ]);
    }
}
