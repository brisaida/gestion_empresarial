<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ExistenciaResource;
use App\Models\Existencia;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExistenciaController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Existencia::with(['producto', 'bodega'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('bodega_id')) {
            $query->where('bodega_id', $request->integer('bodega_id'));
        }

        if ($request->filled('producto_id')) {
            $query->where('producto_id', $request->integer('producto_id'));
        }

        if ($request->filled('categoria_id')) {
            $query->whereHas('producto.categorias', function ($q) use ($request) {
                $q->where('categorias.id', $request->integer('categoria_id'));
            });
        }

        if ($request->boolean('stock_bajo', false)) {
            return $this->stockBajoResponse($request);
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('producto', function ($q) use ($search) {
                $q->where('nombre', 'ilike', "%{$search}%")
                  ->orWhere('codigo', 'ilike', "%{$search}%");
            });
        }

        $data = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data'    => ExistenciaResource::collection($data),
            'meta'    => [
                'total'        => $data->total(),
                'current_page' => $data->currentPage(),
                'last_page'    => $data->lastPage(),
            ],
        ]);
    }

    /**
     * Alertas de stock: productos con stock = 0 o por debajo del mínimo.
     * Consulta productos directamente para incluir los que no tienen filas en existencias.
     */
    private function stockBajoResponse(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $perPage   = $request->integer('per_page', 20);
        $page      = $request->integer('page', 1);
        $search    = $request->string('search');

        $query = Producto::where('empresa_id', $empresaId)
            ->where('activo', true)
            ->withSum('existencias', 'cantidad')
            ->with('existencias.bodega');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('nombre', 'ilike', "%{$search}%")
                  ->orWhere('codigo', 'ilike', "%{$search}%");
            });
        }

        $todos = $query->get()->filter(function ($p) {
            $total  = (float) ($p->existencias_sum_cantidad ?? 0);
            $minimo = (float) $p->stock_minimo;
            // stock = 0 (sin importar el mínimo) o por debajo del mínimo
            return $total === 0.0 || ($minimo > 0 && $total <= $minimo);
        })->values();

        $total    = $todos->count();
        $items    = $todos->forPage($page, $perPage);

        $data = $items->map(fn($p) => [
            'id'          => $p->id,
            'producto_id' => $p->id,
            'bodega_id'   => null,
            'cantidad'    => (float) ($p->existencias_sum_cantidad ?? 0),
            'producto'    => [
                'id'          => $p->id,
                'nombre'      => $p->nombre,
                'codigo'      => $p->codigo,
                'stock_minimo'=> (float) $p->stock_minimo,
            ],
            'bodega' => null,
        ])->values();

        return response()->json([
            'success' => true,
            'data'    => $data,
            'meta'    => [
                'total'        => $total,
                'current_page' => $page,
                'last_page'    => (int) ceil($total / $perPage) ?: 1,
            ],
        ]);
    }

    /**
     * Resumen de stock por producto (suma de todas las bodegas).
     */
    public function resumenPorProducto(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $resumen = Existencia::query()
            ->selectRaw('producto_id, SUM(cantidad) as total, SUM(cantidad_reservada) as reservada')
            ->where('empresa_id', $empresaId)
            ->groupBy('producto_id')
            ->with('producto:id,nombre,codigo,stock_minimo')
            ->get()
            ->map(fn($e) => [
                'producto_id'    => $e->producto_id,
                'producto'       => $e->producto?->nombre,
                'codigo'         => $e->producto?->codigo,
                'stock_total'    => (float) $e->total,
                'stock_reservado'=> (float) $e->reservada,
                'disponible'     => (float) ($e->total - $e->reservada),
                'stock_minimo'   => (float) $e->producto?->stock_minimo,
                'stock_bajo'     => (float) $e->total <= (float) $e->producto?->stock_minimo,
            ]);

        return response()->json(['success' => true, 'data' => $resumen]);
    }
}
