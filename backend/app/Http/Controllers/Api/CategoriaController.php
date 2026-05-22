<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Category\StoreCategoriaRequest;
use App\Http\Requests\Category\UpdateCategoriaRequest;
use App\Http\Resources\CategoriaResource;
use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoriaController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $query = Categoria::where('empresa_id', $empresaId);

        if ($request->filled('search')) {
            $query->where('nombre', 'ilike', "%{$request->search}%");
        }

        if ($request->boolean('solo_activos', false)) {
            $query->where('activo', true);
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => CategoriaResource::collection($data),
            'meta'    => [
                'total'        => $data->total(),
                'per_page'     => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page'    => $data->lastPage(),
            ],
        ]);
    }

    public function store(StoreCategoriaRequest $request): JsonResponse
    {
        $categoria = Categoria::create($request->validated());
        return $this->created(new CategoriaResource($categoria));
    }

    public function show(Categoria $categoria): JsonResponse
    {
        return response()->json(['success' => true, 'data' => new CategoriaResource($categoria)]);
    }

    public function update(UpdateCategoriaRequest $request, Categoria $categoria): JsonResponse
    {
        $categoria->update($request->validated());
        return response()->json(['success' => true, 'message' => 'Categoría actualizada.', 'data' => new CategoriaResource($categoria)]);
    }

    public function destroy(Categoria $categoria): JsonResponse
    {
        if ($categoria->productos()->exists()) {
            return $this->error('No se puede eliminar: la categoría tiene productos asociados.', 409);
        }
        $categoria->delete();
        return $this->noContent('Categoría eliminada.');
    }
}
