<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\MarcaResource;
use App\Models\Marca;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarcaController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Marca::where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('search')) {
            $query->where('nombre', 'ilike', "%{$request->search}%");
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => MarcaResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
            'nombre'     => ['required', 'string', 'max:100'],
            'activo'     => ['boolean'],
        ]);
        $marca = Marca::create($data);
        return $this->created(new MarcaResource($marca));
    }

    public function show(Marca $marca): JsonResponse
    {
        return response()->json(['success' => true, 'data' => new MarcaResource($marca)]);
    }

    public function update(Request $request, Marca $marca): JsonResponse
    {
        $data = $request->validate([
            'nombre' => ['sometimes', 'required', 'string', 'max:100'],
            'activo' => ['boolean'],
        ]);
        $marca->update($data);
        return response()->json(['success' => true, 'message' => 'Marca actualizada.', 'data' => new MarcaResource($marca)]);
    }

    public function destroy(Marca $marca): JsonResponse
    {
        if ($marca->productos()->exists()) {
            return $this->error('No se puede eliminar: la marca tiene productos asociados.', 409);
        }
        $marca->delete();
        return $this->noContent('Marca eliminada.');
    }
}
