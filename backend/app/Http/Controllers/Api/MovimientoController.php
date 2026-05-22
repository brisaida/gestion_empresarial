<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Inventory\StoreMovimientoRequest;
use App\Http\Resources\MovimientoResource;
use App\Models\MovimientoInventario;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MovimientoController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = MovimientoInventario::with(['bodega', 'usuario'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('bodega_id')) {
            $query->where('bodega_id', $request->integer('bodega_id'));
        }

        if ($request->filled('tipo_movimiento')) {
            $query->where('tipo_movimiento', $request->tipo_movimiento);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->fecha_hasta);
        }

        $data = $query->orderByDesc('fecha')->orderByDesc('id')->paginate($request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data'    => MovimientoResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(StoreMovimientoRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $cabecera  = array_merge(
                collect($validated)->except('detalles')->toArray(),
                ['usuario_id' => $request->user()->id, 'tipo_referencia' => 'ajuste_manual']
            );

            $movimiento = $this->inventario->registrarMovimiento($cabecera, $validated['detalles']);
            $movimiento->load(['bodega', 'usuario', 'detalles.producto']);

            return $this->created(new MovimientoResource($movimiento), 'Movimiento registrado correctamente.');
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function show(MovimientoInventario $movimientoInventario): JsonResponse
    {
        $movimientoInventario->load(['bodega', 'usuario', 'detalles.producto']);
        return response()->json(['success' => true, 'data' => new MovimientoResource($movimientoInventario)]);
    }
}
