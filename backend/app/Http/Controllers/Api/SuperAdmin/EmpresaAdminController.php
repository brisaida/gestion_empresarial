<?php

namespace App\Http\Controllers\Api\SuperAdmin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Empresa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmpresaAdminController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Empresa::withCount('usuarios');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('nombre_legal', 'ilike', "%{$request->search}%");
            });
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($e) => [
                'id'             => $e->id,
                'nombre'         => $e->nombre,
                'nombre_legal'   => $e->nombre_legal,
                'rtn'            => $e->rtn,
                'correo'         => $e->correo,
                'telefono'       => $e->telefono,
                'direccion'      => $e->direccion,
                'activo'         => $e->activo,
                'usuarios_count' => $e->usuarios_count,
                'created_at'     => $e->created_at?->toDateString(),
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
            'nombre'       => ['required', 'string', 'max:255'],
            'nombre_legal' => ['nullable', 'string', 'max:255'],
            'rtn'          => ['nullable', 'string', 'max:20'],
            'correo'       => ['nullable', 'email', 'max:255'],
            'telefono'     => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:500'],
        ]);

        $empresa = Empresa::create(array_merge($validated, ['activo' => true]));

        return $this->created([
            'id'           => $empresa->id,
            'nombre'       => $empresa->nombre,
            'nombre_legal' => $empresa->nombre_legal,
            'activo'       => $empresa->activo,
        ], 'Empresa creada correctamente.');
    }

    public function update(Request $request, Empresa $empresa): JsonResponse
    {
        $validated = $request->validate([
            'nombre'       => ['required', 'string', 'max:255'],
            'nombre_legal' => ['nullable', 'string', 'max:255'],
            'rtn'          => ['nullable', 'string', 'max:20'],
            'correo'       => ['nullable', 'email', 'max:255'],
            'telefono'     => ['nullable', 'string', 'max:30'],
            'direccion'    => ['nullable', 'string', 'max:500'],
        ]);

        $empresa->update($validated);

        return response()->json(['success' => true, 'message' => 'Empresa actualizada.']);
    }

    public function toggle(Empresa $empresa): JsonResponse
    {
        $empresa->update(['activo' => !$empresa->activo]);

        return response()->json([
            'success' => true,
            'message' => $empresa->activo ? 'Empresa activada.' : 'Empresa desactivada.',
        ]);
    }
}
