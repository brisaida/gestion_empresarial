<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Product\StoreProductoRequest;
use App\Http\Requests\Product\UpdateProductoRequest;
use App\Http\Resources\ProductoResource;
use App\Models\Existencia;
use App\Models\Producto;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductoController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = Producto::where('empresa_id', $request->integer('empresa_id'))
            ->with(['categorias', 'marca', 'unidadMedida'])
            ->withSum('existencias', 'cantidad');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('nombre', 'ilike', "%{$request->search}%")
                  ->orWhere('codigo', 'ilike', "%{$request->search}%")
                  ->orWhere('codigo_barra', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('categoria_id')) {
            $query->whereHas('categorias', fn($q) => $q->where('categorias.id', $request->integer('categoria_id')));
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
        $data = $request->validated();

        $categoriaIds = $data['categoria_ids'] ?? [];
        $stockInicial = (float) ($data['stock_inicial'] ?? 0);
        $bodegaId     = $data['bodega_id'] ?? null;

        unset($data['categoria_ids'], $data['stock_inicial'], $data['bodega_id']);

        $producto = DB::transaction(function () use ($data, $categoriaIds, $stockInicial, $bodegaId) {
            $producto = Producto::create($data);
            $producto->categorias()->sync($categoriaIds);

            if ($stockInicial > 0 && $bodegaId) {
                Existencia::create([
                    'empresa_id'         => $producto->empresa_id,
                    'producto_id'        => $producto->id,
                    'bodega_id'          => $bodegaId,
                    'cantidad'           => $stockInicial,
                    'cantidad_reservada' => 0,
                ]);
            }

            return $producto;
        });

        $producto->load(['categorias', 'marca', 'unidadMedida']);
        return $this->created(new ProductoResource($producto));
    }

    public function show(Producto $producto): JsonResponse
    {
        $producto->load(['categorias', 'marca', 'unidadMedida', 'existencias.bodega']);
        return response()->json(['success' => true, 'data' => new ProductoResource($producto)]);
    }

    public function update(UpdateProductoRequest $request, Producto $producto): JsonResponse
    {
        $data = $request->validated();
        $categoriaIds = $data['categoria_ids'] ?? [];
        unset($data['categoria_ids']);

        $producto->update($data);
        $producto->categorias()->sync($categoriaIds);
        $producto->load(['categorias', 'marca', 'unidadMedida']);
        return response()->json([
            'success' => true,
            'message' => 'Producto actualizado.',
            'data'    => new ProductoResource($producto),
        ]);
    }

    public function uploadImagen(Request $request, Producto $producto): JsonResponse
    {
        $request->validate([
            'imagen' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:10240'],
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

    /**
     * "Eliminar" un producto es desactivarlo: se conserva para el historial de
     * ventas, compras y movimientos. Si tiene existencias, solo se desactiva
     * cuando se confirma descartarlas con un ajuste de inventario (salida).
     */
    public function destroy(Request $request, Producto $producto): JsonResponse
    {
        return $this->desactivar($request, collect([$producto]));
    }

    public function destroyMasivo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:productos,id'],
        ]);

        return $this->desactivar($request, Producto::whereIn('id', $validated['ids'])->get());
    }

    private function desactivar(Request $request, Collection $productos): JsonResponse
    {
        $existencias = Existencia::whereIn('producto_id', $productos->pluck('id'))
            ->where('cantidad', '>', 0)
            ->get();

        if ($existencias->isNotEmpty() && ! $request->boolean('descartar_existencias')) {
            $nombres = $productos->whereIn('id', $existencias->pluck('producto_id'))->pluck('nombre');
            return $this->error(
                'Los siguientes productos tienen existencias en inventario: ' . $nombres->implode(', ')
                . '. Confirma el descarte de existencias para eliminarlos.',
                409
            );
        }

        try {
            DB::transaction(function () use ($request, $productos, $existencias) {
                $costos = $productos->pluck('costo', 'id');

                // Un ajuste negativo por bodega con todo lo que se descarta
                foreach ($existencias->groupBy(fn($e) => "{$e->empresa_id}-{$e->bodega_id}") as $grupo) {
                    $this->inventario->registrarMovimiento(
                        [
                            'empresa_id'      => $grupo->first()->empresa_id,
                            'bodega_id'       => $grupo->first()->bodega_id,
                            'usuario_id'      => $request->user()->id,
                            'tipo_movimiento' => 'ajuste_negativo',
                            'tipo_referencia' => 'baja_producto',
                            'fecha'           => now()->toDateString(),
                            'observaciones'   => 'Descarte de existencias por eliminación de producto',
                        ],
                        $grupo->map(fn($e) => [
                            'producto_id'       => $e->producto_id,
                            'cantidad'          => (float) $e->cantidad,
                            'costo_unitario'    => (float) ($costos[$e->producto_id] ?? 0),
                            'lote'              => $e->lote,
                            'fecha_vencimiento' => $e->fecha_vencimiento?->toDateString(),
                            'numero_serie'      => $e->numero_serie,
                        ])->all()
                    );
                }

                Producto::whereIn('id', $productos->pluck('id'))->update(['activo' => false]);
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $total = $productos->count();
        return $this->noContent($total === 1 ? 'Producto eliminado.' : "{$total} productos eliminados.");
    }

}
