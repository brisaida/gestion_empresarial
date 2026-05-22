<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UnidadMedidaResource;
use App\Models\UnidadMedida;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnidadMedidaController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $data = UnidadMedida::where('empresa_id', $request->integer('empresa_id'))
            ->orderBy('nombre')
            ->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => UnidadMedidaResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'empresa_id'  => ['required', 'integer', 'exists:empresas,id'],
            'nombre'      => ['required', 'string', 'max:60'],
            'abreviatura' => ['required', 'string', 'max:10'],
            'activo'      => ['boolean'],
        ]);
        $unidad = UnidadMedida::create($data);
        return $this->created(new UnidadMedidaResource($unidad));
    }

    public function show(UnidadMedida $unidadMedida): JsonResponse
    {
        return response()->json(['success' => true, 'data' => new UnidadMedidaResource($unidadMedida)]);
    }

    public function update(Request $request, UnidadMedida $unidadMedida): JsonResponse
    {
        $data = $request->validate([
            'nombre'      => ['sometimes', 'required', 'string', 'max:60'],
            'abreviatura' => ['sometimes', 'required', 'string', 'max:10'],
            'activo'      => ['boolean'],
        ]);
        $unidadMedida->update($data);
        return response()->json(['success' => true, 'message' => 'Unidad actualizada.', 'data' => new UnidadMedidaResource($unidadMedida)]);
    }

    public function destroy(UnidadMedida $unidadMedida): JsonResponse
    {
        if ($unidadMedida->productos()->exists()) {
            return $this->error('No se puede eliminar: la unidad tiene productos asociados.', 409);
        }
        $unidadMedida->delete();
        return $this->noContent('Unidad de medida eliminada.');
    }
}
