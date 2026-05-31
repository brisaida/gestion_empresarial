<?php

namespace App\Http\Middleware;

use App\Models\Rol;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TienePermiso
{
    public function handle(Request $request, Closure $next, string $modulo): Response
    {
        $user = $request->user();

        // Super admins bypasan todo
        if ($user->es_super_admin) {
            return $next($request);
        }

        // Sin empresa en el request (sub-acciones sobre recursos específicos):
        // el controller ya valida la propiedad del recurso, dejamos pasar
        $empresaId = $request->integer('empresa_id');
        if ($empresaId === 0) {
            return $next($request);
        }

        $pivot = $user->empresas()
            ->where('empresa_id', $empresaId)
            ->where('usuarios_empresas.activo', true)
            ->first()?->pivot;

        if (! $pivot?->rol_id) {
            return response()->json([
                'success' => false,
                'message' => 'Sin acceso a esta empresa.',
            ], 403);
        }

        $rol = Rol::find($pivot->rol_id);

        // modulos null = acceso total (rol de administrador sin restricciones)
        if (! $rol || $rol->modulos === null) {
            return $next($request);
        }

        if (! in_array($modulo, $rol->modulos)) {
            return response()->json([
                'success' => false,
                'message' => "Sin permiso para acceder al módulo '{$modulo}'.",
            ], 403);
        }

        return $next($request);
    }
}
