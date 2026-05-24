<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Inventory\StoreVentaRequest;
use App\Http\Resources\VentaResource;
use App\Models\Producto;
use App\Models\Venta;
use App\Models\DetalleVenta;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VentaController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = Venta::with(['cliente', 'bodega'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_venta', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_venta', '<=', $request->fecha_hasta);
        }

        $data = $query->orderByDesc('fecha_venta')->orderByDesc('id')->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => VentaResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    /** Devuelve el siguiente número de factura correlativo para la empresa. */
    public function siguienteNumero(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $ultima = Venta::where('empresa_id', $empresaId)
            ->whereNotNull('numero_factura')
            ->where('numero_factura', 'like', 'FAC-%')
            ->orderByDesc('id')
            ->value('numero_factura');

        $siguiente = 1;
        if ($ultima) {
            $partes    = explode('-', $ultima);
            $siguiente = ((int) end($partes)) + 1;
        }

        return response()->json([
            'success' => true,
            'data'    => ['numero_factura' => 'FAC-' . str_pad($siguiente, 4, '0', STR_PAD_LEFT)],
        ]);
    }

    public function store(StoreVentaRequest $request): JsonResponse
    {
        $validated = $request->validated();

        try {
            $venta = DB::transaction(function () use ($validated, $request) {
                $subtotal  = collect($validated['detalles'])->sum(fn($d) => $d['cantidad'] * $d['precio_unitario']);
                $descuento = $validated['descuento'] ?? 0;
                $impuesto  = $validated['impuesto'] ?? 0;

                // Auto-generar número correlativo si no viene en el payload
                $numeroFactura = $validated['numero_factura'] ?? null;
                if (! $numeroFactura) {
                    $ultima = Venta::where('empresa_id', $validated['empresa_id'])
                        ->whereNotNull('numero_factura')
                        ->where('numero_factura', 'like', 'FAC-%')
                        ->lockForUpdate()
                        ->orderByDesc('id')
                        ->value('numero_factura');

                    $siguiente     = $ultima ? ((int) end(explode('-', $ultima))) + 1 : 1;
                    $numeroFactura = 'FAC-' . str_pad($siguiente, 4, '0', STR_PAD_LEFT);
                }

                $venta = Venta::create([
                    'empresa_id'     => $validated['empresa_id'],
                    'cliente_id'     => $validated['cliente_id'] ?? null,
                    'bodega_id'      => $validated['bodega_id'],
                    'usuario_id'     => $request->user()->id,
                    'numero_factura' => $numeroFactura,
                    'fecha_venta'    => $validated['fecha_venta'],
                    'subtotal'       => $subtotal,
                    'descuento'      => $descuento,
                    'impuesto'       => $impuesto,
                    'total'          => $subtotal - $descuento + $impuesto,
                    'estado'         => 'completada',
                ]);

                // Cargar costos actuales de todos los productos en una sola consulta
                $productoIds = collect($validated['detalles'])->pluck('producto_id')->unique();
                $costos = Producto::whereIn('id', $productoIds)
                    ->pluck('costo', 'id');   // [producto_id => costo_promedio_ponderado]

                foreach ($validated['detalles'] as $det) {
                    DetalleVenta::create([
                        'venta_id'        => $venta->id,
                        'producto_id'     => $det['producto_id'],
                        'cantidad'        => $det['cantidad'],
                        'precio_unitario' => $det['precio_unitario'],
                        // Capturar el costo al momento de la venta (snapshot para COGS)
                        'costo_unitario'  => $costos[$det['producto_id']] ?? 0,
                        'subtotal'        => $det['cantidad'] * $det['precio_unitario'],
                    ]);
                }

                $venta->load('detalles');
                $this->inventario->procesarVenta($venta, $request->user()->id);

                return $venta;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $venta->load(['cliente', 'bodega', 'detalles.producto']);
        return $this->created(new VentaResource($venta));
    }

    public function show(Venta $venta): JsonResponse
    {
        $venta->load(['cliente', 'bodega', 'detalles.producto']);
        return response()->json(['success' => true, 'data' => new VentaResource($venta)]);
    }

    public function cancelar(Venta $venta): JsonResponse
    {
        if ($venta->estado === 'cancelada') {
            return $this->error('La venta ya está cancelada.', 409);
        }
        $venta->update(['estado' => 'cancelada']);
        return response()->json(['success' => true, 'message' => 'Venta cancelada.', 'data' => new VentaResource($venta)]);
    }
}
