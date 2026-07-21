<?php

namespace App\Http\Controllers\Api\SuperAdmin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Empresa;
use App\Models\Rol;
use App\Models\User;
use App\Models\UsuarioEmpresa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UsuarioAdminController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = User::withCount('empresas');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('correo', 'ilike', "%{$request->search}%");
            });
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($u) => [
                'id'             => $u->id,
                'nombre'         => $u->nombre,
                'correo'         => $u->correo,
                'activo'         => $u->activo,
                'es_super_admin' => $u->es_super_admin,
                'empresas_count' => $u->empresas_count,
                'created_at'     => $u->created_at?->toDateString(),
            ]),
            'meta' => [
                'total'        => $data->total(),
                'per_page'     => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page'    => $data->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre'         => ['required', 'string', 'max:255'],
            'correo'         => ['required', 'email', 'unique:usuarios,correo'],
            'password'       => ['required', 'string', 'min:8'],
            'es_super_admin' => ['boolean'],
        ]);

        $user = User::create([
            'nombre'         => $validated['nombre'],
            'correo'         => $validated['correo'],
            'password'       => Hash::make($validated['password']),
            'es_super_admin' => $validated['es_super_admin'] ?? false,
            'activo'         => true,
        ]);

        return $this->created([
            'id'             => $user->id,
            'nombre'         => $user->nombre,
            'correo'         => $user->correo,
            'activo'         => $user->activo,
            'es_super_admin' => $user->es_super_admin,
        ], 'Usuario creado correctamente.');
    }

    public function update(Request $request, User $usuario): JsonResponse
    {
        $validated = $request->validate([
            'nombre'         => ['required', 'string', 'max:255'],
            'correo'         => ['required', 'email', "unique:usuarios,correo,{$usuario->id}"],
            'es_super_admin' => ['boolean'],
            'password'       => ['nullable', 'string', 'min:8'],
        ]);

        $data = [
            'nombre'         => $validated['nombre'],
            'correo'         => $validated['correo'],
            'es_super_admin' => $validated['es_super_admin'] ?? $usuario->es_super_admin,
        ];

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $usuario->update($data);

        return response()->json(['success' => true, 'message' => 'Usuario actualizado.']);
    }

    public function toggle(User $usuario): JsonResponse
    {
        $usuario->update(['activo' => !$usuario->activo]);
        $msg = $usuario->activo ? 'Usuario activado.' : 'Usuario desactivado.';

        return response()->json(['success' => true, 'message' => $msg]);
    }

    public function empresas(User $usuario): JsonResponse
    {
        $roles = Rol::pluck('nombre', 'id');

        $empresas = $usuario->empresas()
            ->withPivot('rol_id', 'activo')
            ->get()
            ->map(fn($e) => [
                'empresa_id'     => $e->id,
                'empresa_nombre' => $e->nombre,
                'rol_id'         => $e->pivot->rol_id,
                'rol_nombre'     => $roles[$e->pivot->rol_id] ?? '—',
                'activo'         => (bool) $e->pivot->activo,
            ]);

        return response()->json(['success' => true, 'data' => $empresas]);
    }

    public function asignarEmpresa(Request $request, User $usuario): JsonResponse
    {
        $validated = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
            'rol_id'     => ['required', 'integer', 'exists:roles,id'],
        ]);

        $existe = UsuarioEmpresa::where('usuario_id', $usuario->id)
            ->where('empresa_id', $validated['empresa_id'])
            ->exists();

        if ($existe) {
            return $this->error('El usuario ya tiene acceso a esta empresa.', 422);
        }

        UsuarioEmpresa::create([
            'usuario_id' => $usuario->id,
            'empresa_id' => $validated['empresa_id'],
            'rol_id'     => $validated['rol_id'],
            'activo'     => true,
        ]);

        return $this->created(null, 'Acceso asignado correctamente.');
    }

    public function cambiarRol(Request $request, User $usuario, Empresa $empresa): JsonResponse
    {
        $validated = $request->validate([
            'rol_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        UsuarioEmpresa::where('usuario_id', $usuario->id)
            ->where('empresa_id', $empresa->id)
            ->update(['rol_id' => $validated['rol_id']]);

        return response()->json(['success' => true, 'message' => 'Rol actualizado.']);
    }

    public function quitarEmpresa(User $usuario, Empresa $empresa): JsonResponse
    {
        UsuarioEmpresa::where('usuario_id', $usuario->id)
            ->where('empresa_id', $empresa->id)
            ->delete();

        return $this->noContent('Acceso removido correctamente.');
    }

    public function roles(): JsonResponse
    {
        $roles = Rol::orderBy('nombre')->get(['id', 'nombre']);

        return response()->json(['success' => true, 'data' => $roles]);
    }
}
