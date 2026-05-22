<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ExistenciaResource;
use App\Models\Existencia;
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

        if ($request->boolean('stock_bajo', false)) {
            // productos con cantidad <= stock_minimo
            $query->whereHas('producto', function ($q) {
                $q->whereColumn('existencias.cantidad', '<=', 'productos.stock_minimo')
                  ->where('productos.stock_minimo', '>', 0);
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
