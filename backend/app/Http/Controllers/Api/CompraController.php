<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Inventory\StoreCompraRequest;
use App\Http\Resources\CompraResource;
use App\Models\Compra;
use App\Models\DetalleCompra;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompraController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = Compra::with(['proveedor', 'bodega'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('proveedor_id')) {
            $query->where('proveedor_id', $request->integer('proveedor_id'));
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_compra', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_compra', '<=', $request->fecha_hasta);
        }

        $data = $query->orderByDesc('fecha_compra')->orderByDesc('id')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => CompraResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    public function store(StoreCompraRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $compra = DB::transaction(function () use ($validated, $request) {
            $subtotal = collect($validated['detalles'])->sum(fn($d) => $d['cantidad'] * $d['costo_unitario']);
            $descuento = $validated['descuento'] ?? 0;
            $impuesto  = $validated['impuesto'] ?? 0;

            $compra = Compra::create([
                'empresa_id'     => $validated['empresa_id'],
                'proveedor_id'   => $validated['proveedor_id'],
                'bodega_id'      => $validated['bodega_id'],
                'usuario_id'     => $request->user()->id,
                'numero_factura' => $validated['numero_factura'] ?? null,
                'fecha_compra'   => $validated['fecha_compra'],
                'subtotal'       => $subtotal,
                'descuento'      => $descuento,
                'impuesto'       => $impuesto,
                'total'          => $subtotal - $descuento + $impuesto,
                'estado'         => 'pendiente',
            ]);

            foreach ($validated['detalles'] as $det) {
                DetalleCompra::create([
                    'compra_id'        => $compra->id,
                    'producto_id'      => $det['producto_id'],
                    'cantidad'         => $det['cantidad'],
                    'costo_unitario'   => $det['costo_unitario'],
                    'subtotal'         => $det['cantidad'] * $det['costo_unitario'],
                    'lote'             => $det['lote'] ?? null,
                    'fecha_vencimiento' => $det['fecha_vencimiento'] ?? null,
                ]);
            }

            return $compra;
        });

        $compra->load(['proveedor', 'bodega', 'detalles.producto']);
        return $this->created(new CompraResource($compra));
    }

    public function show(Compra $compra): JsonResponse
    {
        $compra->load(['proveedor', 'bodega', 'detalles.producto']);
        return response()->json(['success' => true, 'data' => new CompraResource($compra)]);
    }

    /**
     * Marca la compra como recibida y actualiza el stock.
     */
    public function recibir(Compra $compra, Request $request): JsonResponse
    {
        if ($compra->estado !== 'pendiente') {
            return $this->error("La compra ya está en estado '{$compra->estado}'.", 409);
        }

        try {
            DB::transaction(function () use ($compra, $request) {
                $compra->update(['estado' => 'recibida']);
                $compra->load('detalles');
                $this->inventario->procesarCompra($compra, $request->user()->id);
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $compra->load(['proveedor', 'bodega', 'detalles.producto']);
        return response()->json(['success' => true, 'message' => 'Compra recibida y stock actualizado.', 'data' => new CompraResource($compra)]);
    }

    public function cancelar(Compra $compra): JsonResponse
    {
        if ($compra->estado !== 'pendiente') {
            return $this->error("Solo se pueden cancelar compras pendientes.", 409);
        }
        $compra->update(['estado' => 'cancelada']);
        return response()->json(['success' => true, 'message' => 'Compra cancelada.', 'data' => new CompraResource($compra)]);
    }
}
