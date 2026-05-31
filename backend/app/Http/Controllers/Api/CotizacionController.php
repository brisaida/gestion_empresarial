<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\CotizacionResource;
use App\Http\Resources\VentaResource;
use App\Models\Cotizacion;
use App\Models\DetalleCotizacion;
use App\Models\Venta;
use App\Models\DetalleVenta;
use App\Models\Producto;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CotizacionController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    /* ── Siguiente número correlativo ─────────────────────────────── */
    public function siguienteNumero(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $ultima = Cotizacion::where('empresa_id', $empresaId)
            ->where('numero_cotizacion', 'like', 'COT-%')
            ->orderByDesc('id')
            ->value('numero_cotizacion');

        $partes    = $ultima ? explode('-', $ultima) : [];
        $siguiente = $partes ? ((int) end($partes)) + 1 : 1;

        return response()->json([
            'success' => true,
            'data'    => ['numero_cotizacion' => 'COT-' . str_pad($siguiente, 4, '0', STR_PAD_LEFT)],
        ]);
    }

    /* ── Listado ──────────────────────────────────────────────────── */
    public function index(Request $request): JsonResponse
    {
        $query = Cotizacion::with(['cliente'])
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado'))      $query->where('estado', $request->estado);
        if ($request->filled('search'))      $query->where('numero_cotizacion', 'like', "%{$request->search}%");
        if ($request->filled('fecha_desde')) $query->whereDate('fecha_cotizacion', '>=', $request->fecha_desde);
        if ($request->filled('fecha_hasta')) $query->whereDate('fecha_cotizacion', '<=', $request->fecha_hasta);

        $data = $query->orderByDesc('fecha_cotizacion')->orderByDesc('id')
                      ->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => CotizacionResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    /* ── Crear ────────────────────────────────────────────────────── */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'empresa_id'         => ['required', 'integer', 'exists:empresas,id'],
            'cliente_id'         => ['nullable', 'integer', 'exists:clientes,id'],
            'fecha_cotizacion'   => ['required', 'date'],
            'fecha_vencimiento'  => ['nullable', 'date', 'after_or_equal:fecha_cotizacion'],
            'observaciones'      => ['nullable', 'string', 'max:1000'],
            'descuento'          => ['nullable', 'numeric', 'min:0'],
            'impuesto'           => ['nullable', 'numeric', 'min:0'],
            'detalles'           => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'     => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.cantidad'        => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
        ]);

        $cotizacion = DB::transaction(function () use ($validated, $request) {
            $subtotal  = collect($validated['detalles'])->sum(fn($d) => $d['cantidad'] * $d['precio_unitario']);
            $descuento = $validated['descuento'] ?? 0;
            $impuesto  = $validated['impuesto']  ?? 0;

            // Número correlativo
            $ultima    = Cotizacion::where('empresa_id', $validated['empresa_id'])
                ->where('numero_cotizacion', 'like', 'COT-%')
                ->lockForUpdate()->orderByDesc('id')->value('numero_cotizacion');
            $partes    = $ultima ? explode('-', $ultima) : [];
            $siguiente = $partes ? ((int) end($partes)) + 1 : 1;
            $numero    = 'COT-' . str_pad($siguiente, 4, '0', STR_PAD_LEFT);

            $cotizacion = Cotizacion::create([
                'empresa_id'        => $validated['empresa_id'],
                'cliente_id'        => $validated['cliente_id'] ?? null,
                'usuario_id'        => $request->user()->id,
                'numero_cotizacion' => $numero,
                'fecha_cotizacion'  => $validated['fecha_cotizacion'],
                'fecha_vencimiento' => $validated['fecha_vencimiento'] ?? null,
                'observaciones'     => $validated['observaciones'] ?? null,
                'subtotal'          => $subtotal,
                'descuento'         => $descuento,
                'impuesto'          => $impuesto,
                'total'             => $subtotal - $descuento + $impuesto,
                'estado'            => 'borrador',
            ]);

            foreach ($validated['detalles'] as $det) {
                DetalleCotizacion::create([
                    'cotizacion_id'   => $cotizacion->id,
                    'producto_id'     => $det['producto_id'],
                    'cantidad'        => $det['cantidad'],
                    'precio_unitario' => $det['precio_unitario'],
                    'subtotal'        => $det['cantidad'] * $det['precio_unitario'],
                ]);
            }

            return $cotizacion->load(['cliente', 'detalles.producto']);
        });

        return $this->created(new CotizacionResource($cotizacion));
    }

    /* ── Ver detalle ──────────────────────────────────────────────── */
    public function show(Cotizacion $cotizacion): JsonResponse
    {
        $cotizacion->load(['cliente', 'detalles.producto']);
        return response()->json(['success' => true, 'data' => new CotizacionResource($cotizacion)]);
    }

    /* ── Editar (solo si está en borrador) ───────────────────────── */
    public function update(Request $request, Cotizacion $cotizacion): JsonResponse
    {
        if ($cotizacion->estado !== 'borrador') {
            return $this->error('Solo se pueden editar cotizaciones en estado borrador.', 422);
        }

        $validated = $request->validate([
            'cliente_id'         => ['nullable', 'integer', 'exists:clientes,id'],
            'fecha_cotizacion'   => ['required', 'date'],
            'fecha_vencimiento'  => ['nullable', 'date', 'after_or_equal:fecha_cotizacion'],
            'observaciones'      => ['nullable', 'string', 'max:1000'],
            'descuento'          => ['nullable', 'numeric', 'min:0'],
            'impuesto'           => ['nullable', 'numeric', 'min:0'],
            'detalles'           => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'     => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.cantidad'        => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($cotizacion, $validated) {
            $subtotal  = collect($validated['detalles'])->sum(fn($d) => $d['cantidad'] * $d['precio_unitario']);
            $descuento = $validated['descuento'] ?? 0;
            $impuesto  = $validated['impuesto']  ?? 0;

            $cotizacion->update([
                'cliente_id'        => $validated['cliente_id'] ?? null,
                'fecha_cotizacion'  => $validated['fecha_cotizacion'],
                'fecha_vencimiento' => $validated['fecha_vencimiento'] ?? null,
                'observaciones'     => $validated['observaciones'] ?? null,
                'subtotal'          => $subtotal,
                'descuento'         => $descuento,
                'impuesto'          => $impuesto,
                'total'             => $subtotal - $descuento + $impuesto,
            ]);

            $cotizacion->detalles()->delete();
            foreach ($validated['detalles'] as $det) {
                DetalleCotizacion::create([
                    'cotizacion_id'   => $cotizacion->id,
                    'producto_id'     => $det['producto_id'],
                    'cantidad'        => $det['cantidad'],
                    'precio_unitario' => $det['precio_unitario'],
                    'subtotal'        => $det['cantidad'] * $det['precio_unitario'],
                ]);
            }
        });

        $cotizacion->load(['cliente', 'detalles.producto']);
        return response()->json(['success' => true, 'message' => 'Cotización actualizada.', 'data' => new CotizacionResource($cotizacion)]);
    }

    /* ── Cambiar estado ───────────────────────────────────────────── */
    public function cambiarEstado(Request $request, Cotizacion $cotizacion): JsonResponse
    {
        $request->validate(['estado' => ['required', 'string']]);
        $nuevoEstado = $request->estado;

        // Transiciones válidas
        $transiciones = [
            'borrador' => ['enviada'],
            'enviada'  => ['aprobada', 'rechazada', 'borrador'],
            'aprobada' => ['rechazada'],
        ];

        $permitidos = $transiciones[$cotizacion->estado] ?? [];
        if (! in_array($nuevoEstado, $permitidos)) {
            return $this->error("No se puede cambiar de '{$cotizacion->estado}' a '{$nuevoEstado}'.", 422);
        }

        $cotizacion->update(['estado' => $nuevoEstado]);
        return response()->json(['success' => true, 'message' => 'Estado actualizado.', 'data' => new CotizacionResource($cotizacion)]);
    }

    /* ── Convertir a venta ────────────────────────────────────────── */
    public function convertirAVenta(Request $request, Cotizacion $cotizacion): JsonResponse
    {
        if ($cotizacion->estado !== 'aprobada') {
            return $this->error('Solo se pueden convertir cotizaciones aprobadas.', 422);
        }

        $request->validate([
            'bodega_id'  => ['required', 'integer', 'exists:bodegas,id'],
            'fecha_venta' => ['nullable', 'date'],
        ]);

        $cotizacion->load('detalles');

        try {
            $venta = DB::transaction(function () use ($cotizacion, $request) {
                // Siguiente número de factura
                $ultima    = Venta::where('empresa_id', $cotizacion->empresa_id)
                    ->where('numero_factura', 'like', 'FAC-%')
                    ->lockForUpdate()->orderByDesc('id')->value('numero_factura');
                $partes    = $ultima ? explode('-', $ultima) : [];
                $siguiente = $partes ? ((int) end($partes)) + 1 : 1;
                $numero    = 'FAC-' . str_pad($siguiente, 4, '0', STR_PAD_LEFT);

                // Costos actuales
                $productoIds = $cotizacion->detalles->pluck('producto_id')->unique();
                $costos      = Producto::whereIn('id', $productoIds)->pluck('costo', 'id');

                $venta = Venta::create([
                    'empresa_id'     => $cotizacion->empresa_id,
                    'cliente_id'     => $cotizacion->cliente_id,
                    'bodega_id'      => $request->integer('bodega_id'),
                    'usuario_id'     => $request->user()->id,
                    'numero_factura' => $numero,
                    'fecha_venta'    => $request->input('fecha_venta', today()->toDateString()),
                    'subtotal'       => $cotizacion->subtotal,
                    'descuento'      => $cotizacion->descuento,
                    'impuesto'       => $cotizacion->impuesto,
                    'total'          => $cotizacion->total,
                    'estado'         => 'completada',
                ]);

                foreach ($cotizacion->detalles as $det) {
                    DetalleVenta::create([
                        'venta_id'        => $venta->id,
                        'producto_id'     => $det->producto_id,
                        'cantidad'        => $det->cantidad,
                        'precio_unitario' => $det->precio_unitario,
                        'costo_unitario'  => $costos[$det->producto_id] ?? 0,
                        'subtotal'        => $det->subtotal,
                    ]);
                }

                $venta->load('detalles');
                $this->inventario->procesarVenta($venta, $request->user()->id);

                $cotizacion->update(['estado' => 'convertida', 'venta_id' => $venta->id]);

                return $venta;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $venta->load(['cliente', 'bodega', 'detalles.producto']);
        return response()->json([
            'success' => true,
            'message' => "Cotización convertida a venta {$venta->numero_factura}.",
            'data'    => new VentaResource($venta),
        ]);
    }
}
