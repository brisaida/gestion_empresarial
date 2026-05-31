<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EsSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->es_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. Se requieren permisos de super administrador.',
            ], 403);
        }

        return $next($request);
    }
}
