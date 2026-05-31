<?php

namespace App\Http\Controllers\Api\SuperAdmin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Rol;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RolAdminController extends ApiController
{
    private function formatRol(Rol $r): array
    {
        return [
            'id'          => $r->id,
            'nombre'      => $r->nombre,
            'descripcion' => $r->descripcion,
            'modulos'     => $r->modulos,
            'asignaciones'=> $r->asignaciones ?? 0,
        ];
    }

    public function index(): JsonResponse
    {
        $roles = Rol::withCount('usuariosEmpresas as asignaciones')
            ->orderBy('nombre')
            ->get()
            ->map(fn($r) => $this->formatRol($r));

        return response()->json(['success' => true, 'data' => $roles]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre'      => ['required', 'string', 'max:100', 'unique:roles,nombre'],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'modulos'     => ['nullable', 'array'],
            'modulos.*'   => ['string'],
        ]);

        $rol = Rol::create($validated);

        return $this->created($this->formatRol($rol), 'Rol creado correctamente.');
    }

    public function update(Request $request, Rol $rol): JsonResponse
    {
        $validated = $request->validate([
            'nombre'      => ['required', 'string', 'max:100', "unique:roles,nombre,{$rol->id}"],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'modulos'     => ['nullable', 'array'],
            'modulos.*'   => ['string'],
        ]);

        $rol->update($validated);

        return response()->json(['success' => true, 'data' => $this->formatRol($rol->fresh()), 'message' => 'Rol actualizado.']);
    }

    public function destroy(Rol $rol): JsonResponse
    {
        if ($rol->usuariosEmpresas()->exists()) {
            return $this->error("No se puede eliminar — el rol está asignado a {$rol->usuariosEmpresas()->count()} usuario(s).", 422);
        }

        $rol->delete();

        return $this->noContent('Rol eliminado.');
    }
}
