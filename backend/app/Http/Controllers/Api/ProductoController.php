<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Product\StoreProductoRequest;
use App\Http\Requests\Product\UpdateProductoRequest;
use App\Http\Resources\ProductoResource;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->string('tipo'));
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

    public function uploadImagen(Request $request, Producto $producto): JsonResponse
    {
        $request->validate([
            'imagen' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        // Eliminar imagen anterior si existe
        if ($producto->imagen) {
            Storage::disk('public')->delete($producto->imagen);
        }

        $path = $request->file('imagen')->store('productos', 'public');
        $producto->update(['imagen' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Imagen actualizada correctamente.',
            'data'    => new ProductoResource($producto->load(['categoria', 'marca', 'unidadMedida'])),
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

    public function destroyMasivo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:productos,id'],
        ]);

        $conStock = Producto::whereIn('id', $validated['ids'])
            ->whereHas('existencias', fn($q) => $q->where('cantidad', '>', 0))
            ->pluck('nombre');

        if ($conStock->isNotEmpty()) {
            return $this->error(
                'No se pueden eliminar los siguientes productos porque tienen stock: ' . $conStock->implode(', '),
                409
            );
        }

        $eliminados = Producto::whereIn('id', $validated['ids'])->delete();

        return response()->json([
            'success' => true,
            'message' => "{$eliminados} producto(s) eliminado(s).",
        ]);
    }
}
