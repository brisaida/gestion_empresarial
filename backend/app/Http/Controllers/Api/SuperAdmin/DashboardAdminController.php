<?php

namespace App\Http\Controllers\Api\SuperAdmin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Empresa;
use App\Models\User;
use App\Models\Rol;
use Illuminate\Http\JsonResponse;

class DashboardAdminController extends ApiController
{
    public function index(): JsonResponse
    {
        $totalEmpresas   = Empresa::count();
        $empresasActivas = Empresa::where('activo', true)->count();

        $totalUsuarios   = User::count();
        $usuariosActivos = User::where('activo', true)->count();
        $superAdmins     = User::where('es_super_admin', true)->count();

        $totalRoles = Rol::count();

        $empresasRecientes = Empresa::withCount('usuarios')
            ->orderByDesc('id')
            ->limit(5)
            ->get(['id', 'nombre', 'nombre_legal', 'activo', 'created_at']);

        $usuariosRecientes = User::orderByDesc('id')
            ->limit(5)
            ->get(['id', 'nombre', 'correo', 'activo', 'es_super_admin', 'created_at']);

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'total_empresas'    => $totalEmpresas,
                    'empresas_activas'  => $empresasActivas,
                    'total_usuarios'    => $totalUsuarios,
                    'usuarios_activos'  => $usuariosActivos,
                    'super_admins'      => $superAdmins,
                    'total_roles'       => $totalRoles,
                ],
                'empresas_recientes' => $empresasRecientes,
                'usuarios_recientes' => $usuariosRecientes,
            ],
        ]);
    }
}
