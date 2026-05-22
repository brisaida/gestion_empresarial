<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Product\StoreProductoRequest;
use App\Http\Requests\Product\UpdateProductoRequest;
use App\Http\Resources\ProductoResource;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductoController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Producto::where('empresa_id', $request->integer('empresa_id'))
            ->with(['categoria', 'marca', 'unidadMedida']);

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('codigo', 'ilike', "%{$request->search}%")
                  ->orWhere('codigo_barra', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('categoria_id')) {
            $query->where('categoria_id', $request->integer('categoria_id'));
        }

        if ($request->filled('marca_id')) {
            $query->where('marca_id', $request->integer('marca_id'));
        }

        if ($request->boolean('solo_activos', false)) {
            $query->where('activo', true);
        }

        $data = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => ProductoResource::collection($data),
            'meta'    => [
                'total'        => $data->total(),
                'per_page'     => $data->perPage(),
                'current_page' => $data->currentPage(),
                'last_page'    => $data->lastPage(),
            ],
        ]);
    }

    public function store(StoreProductoRequest $request): JsonResponse
    {
        $producto = Producto::create($request->validated());
        $producto->load(['categoria', 'marca', 'unidadMedida']);
        return $this->created(new ProductoResource($producto));
    }

    public function show(Producto $producto): JsonResponse
    {
        $producto->load(['categoria', 'marca', 'unidadMedida', 'existencias.bodega']);
        return response()->json(['success' => true, 'data' => new ProductoResource($producto)]);
    }

    public function update(UpdateProductoRequest $request, Producto $producto): JsonResponse
    {
        $producto->update($request->validated());
        $producto->load(['categoria', 'marca', 'unidadMedida']);
        return response()->json([
            'success' => true,
            'message' => 'Producto actualizado.',
            'data'    => new ProductoResource($producto),
        ]);
    }

    public function destroy(Producto $producto): JsonResponse
    {
        if ($producto->existencias()->where('cantidad', '>', 0)->exists()) {
            return $this->error('No se puede eliminar: el producto tiene existencias en inventario.', 409);
        }
        $producto->delete();
        return $this->noContent('Producto eliminado.');
    }
}
