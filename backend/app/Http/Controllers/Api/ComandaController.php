<?php

namespace App\Http\Controllers\Api;

use App\Models\Comanda;
use App\Models\DetalleComanda;
use App\Models\Receta;
use App\Models\Venta;
use App\Models\DetalleVenta;
use App\Models\Producto;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ComandaController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $query = Comanda::with('detalles')
            ->where('empresa_id', $request->integer('empresa_id'));

        if ($request->filled('estado')) {
            $estados = explode(',', $request->estado);
            $query->whereIn('estado', $estados);
        } else {
            $query->whereIn('estado', ['pendiente', 'en_preparacion']);
        }

        $data = $query->orderBy('created_at')->get();

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($c) => $this->resource($c)),
        ]);
    }

    public function siguienteNumero(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $last = Comanda::where('empresa_id', $empresaId)
            ->where('numero_comanda', 'like', 'PED-%')
            ->orderByDesc('id')
            ->value('numero_comanda');

        $siguiente = $last ? ((int) substr($last, 4)) + 1 : 1;

        return response()->json([
            'success' => true,
            'data'    => ['numero_comanda' => 'PED-' . str_pad($siguiente, 3, '0', STR_PAD_LEFT)],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'empresa_id'           => ['required', 'integer', 'exists:empresas,id'],
            'bodega_id'            => ['required', 'integer', 'exists:bodegas,id'],
            'numero_comanda'       => ['nullable', 'string', 'max:20'],
            'mesa_id'              => ['nullable', 'integer', 'exists:mesas,id'],
            'mesa'                 => ['nullable', 'string', 'max:60'],
            'observaciones'        => ['nullable', 'string', 'max:500'],
            'detalles'             => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'     => ['nullable', 'integer', 'exists:productos,id'],
            'detalles.*.receta_id'       => ['nullable', 'integer', 'exists:recetas,id'],
            'detalles.*.nombre_item'     => ['required', 'string', 'max:200'],
            'detalles.*.cantidad'        => ['required', 'numeric', 'min:0.001'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.notas'           => ['nullable', 'string', 'max:500'],
        ]);

        $comanda = DB::transaction(function () use ($validated) {
            $numero = $validated['numero_comanda'] ?? $this->generarNumero($validated['empresa_id']);

            $comanda = Comanda::create([
                'empresa_id'     => $validated['empresa_id'],
                'bodega_id'      => $validated['bodega_id'],
                'mesa_id'        => $validated['mesa_id'] ?? null,
                'numero_comanda' => $numero,
                'mesa'           => $validated['mesa'] ?? null,
                'estado'         => 'pendiente',
                'observaciones'  => $validated['observaciones'] ?? null,
            ]);

            foreach ($validated['detalles'] as $det) {
                DetalleComanda::create([
                    'comanda_id'      => $comanda->id,
                    'producto_id'     => $det['producto_id'] ?? null,
                    'receta_id'       => $det['receta_id'] ?? null,
                    'nombre_item'     => $det['nombre_item'],
                    'cantidad'        => $det['cantidad'],
                    'precio_unitario' => $det['precio_unitario'],
                    'notas'           => $det['notas'] ?? null,
                    'listo'           => false,
                ]);
            }

            return $comanda->load('detalles');
        });

        return $this->created(['success' => true, 'data' => $this->resource($comanda)]);
    }

    public function actualizarEstado(Request $request, Comanda $comanda): JsonResponse
    {
        $validated = $request->validate([
            'estado' => ['required', 'in:pendiente,en_preparacion,listo,cancelado'],
        ]);

        $comanda->update(['estado' => $validated['estado']]);

        return response()->json(['success' => true, 'data' => $this->resource($comanda->load('detalles'))]);
    }

    public function marcarItemListo(Request $request, Comanda $comanda, DetalleComanda $detalle): JsonResponse
    {
        $validated = $request->validate(['listo' => ['required', 'boolean']]);

        $detalle->update(['listo' => $validated['listo']]);

        // Si todos los ítems están listos, poner comanda en_preparacion → listo automáticamente
        $comanda->load('detalles');
        if ($comanda->detalles->every(fn($d) => $d->listo)) {
            $comanda->update(['estado' => 'listo']);
        } elseif ($comanda->estado === 'pendiente' && $validated['listo']) {
            $comanda->update(['estado' => 'en_preparacion']);
        }

        return response()->json(['success' => true, 'data' => $this->resource($comanda->fresh('detalles'))]);
    }

    public function facturar(Request $request, Comanda $comanda): JsonResponse
    {
        if (in_array($comanda->estado, ['cancelado'])) {
            return $this->error('Esta comanda está cancelada.', 409);
        }

        $validated = $request->validate([
            'cliente_id'     => ['nullable', 'integer', 'exists:clientes,id'],
            'descuento'      => ['nullable', 'numeric', 'min:0'],
            'impuesto'       => ['nullable', 'numeric', 'min:0'],
            'numero_factura' => ['nullable', 'string', 'max:30'],
        ]);

        try {
            $venta = DB::transaction(function () use ($comanda, $validated, $request) {
                $comanda->load(['detalles.receta.ingredientes.producto']);

                $subtotal = $comanda->detalles->sum(fn($d) => (float)$d->cantidad * (float)$d->precio_unitario);
                $descuento = (float) ($validated['descuento'] ?? 0);
                $impuesto  = (float) ($validated['impuesto'] ?? 0);

                // Número de factura correlativo si no viene
                $numeroFactura = $validated['numero_factura'] ?? null;
                if (! $numeroFactura) {
                    $last = Venta::where('empresa_id', $comanda->empresa_id)
                        ->where('numero_factura', 'like', 'FAC-%')
                        ->orderByDesc('id')->value('numero_factura');
                    $sig = $last ? ((int) substr($last, 4)) + 1 : 1;
                    $numeroFactura = 'FAC-' . str_pad($sig, 4, '0', STR_PAD_LEFT);
                }

                $venta = Venta::create([
                    'empresa_id'     => $comanda->empresa_id,
                    'bodega_id'      => $comanda->bodega_id,
                    'cliente_id'     => $validated['cliente_id'] ?? null,
                    'usuario_id'     => $request->user()->id,
                    'numero_factura' => $numeroFactura,
                    'fecha_venta'    => now()->toDateString(),
                    'subtotal'       => $subtotal,
                    'descuento'      => $descuento,
                    'impuesto'       => $impuesto,
                    'total'          => $subtotal - $descuento + $impuesto,
                    'estado'         => 'completada',
                ]);

                $recetaIds = $comanda->detalles->whereNotNull('receta_id')->pluck('receta_id')->unique();
                $recetas   = $recetaIds->isNotEmpty()
                    ? Receta::with('ingredientes.producto')->whereIn('id', $recetaIds)->get()->keyBy('id')
                    : collect();

                $productoIds = $comanda->detalles->whereNotNull('producto_id')->pluck('producto_id')->unique();
                $costos      = $productoIds->isNotEmpty()
                    ? Producto::whereIn('id', $productoIds)->pluck('costo', 'id')
                    : collect();

                foreach ($comanda->detalles as $det) {
                    $esReceta = !empty($det->receta_id);
                    $costo = $esReceta
                        ? ($recetas[$det->receta_id]?->ingredientes->sum(fn($i) => (float)$i->cantidad * (float)($i->producto?->costo ?? 0)) ?? 0)
                        : ($costos[$det->producto_id] ?? 0);

                    DetalleVenta::create([
                        'venta_id'        => $venta->id,
                        'producto_id'     => $esReceta ? null : $det->producto_id,
                        'receta_id'       => $esReceta ? $det->receta_id : null,
                        'cantidad'        => $det->cantidad,
                        'precio_unitario' => $det->precio_unitario,
                        'costo_unitario'  => $costo,
                        'subtotal'        => $det->cantidad * $det->precio_unitario,
                    ]);
                }

                $venta->load(['detalles', 'detalles.receta.ingredientes']);
                $this->inventario->procesarVenta($venta, $request->user()->id);

                $comanda->update(['estado' => 'cancelado']); // marcar como procesada

                return $venta;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $venta->load(['cliente', 'bodega', 'detalles.producto']);

        return response()->json(['success' => true, 'data' => $venta]);
    }

    private function generarNumero(int $empresaId): string
    {
        $last = Comanda::where('empresa_id', $empresaId)
            ->where('numero_comanda', 'like', 'PED-%')
            ->orderByDesc('id')->value('numero_comanda');
        $sig = $last ? ((int) substr($last, 4)) + 1 : 1;
        return 'PED-' . str_pad($sig, 3, '0', STR_PAD_LEFT);
    }

    private function resource(Comanda $c): array
    {
        return [
            'id'              => $c->id,
            'empresa_id'      => $c->empresa_id,
            'bodega_id'       => $c->bodega_id,
            'numero_comanda'  => $c->numero_comanda,
            'mesa'            => $c->mesa,
            'estado'          => $c->estado,
            'observaciones'   => $c->observaciones,
            'created_at'      => $c->created_at?->toISOString(),
            'detalles'        => $c->relationLoaded('detalles')
                ? $c->detalles->map(fn($d) => [
                    'id'             => $d->id,
                    'producto_id'    => $d->producto_id,
                    'receta_id'      => $d->receta_id,
                    'nombre_item'    => $d->nombre_item,
                    'cantidad'       => (float) $d->cantidad,
                    'precio_unitario'=> (float) $d->precio_unitario,
                    'notas'          => $d->notas,
                    'listo'          => $d->listo,
                ])->values()
                : [],
        ];
    }
}
