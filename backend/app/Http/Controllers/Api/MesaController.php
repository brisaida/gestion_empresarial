<?php

namespace App\Http\Controllers\Api;

use App\Models\Comanda;
use App\Models\DetalleVenta;
use App\Models\Mesa;
use App\Models\Producto;
use App\Models\Receta;
use App\Models\Venta;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MesaController extends ApiController
{
    public function __construct(private readonly InventarioService $inventario) {}

    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $mesas = Mesa::where('empresa_id', $empresaId)
            ->where('activo', true)
            ->withCount([
                'comandas as comandas_activas' => fn($q) =>
                    $q->whereIn('estado', ['pendiente', 'en_preparacion']),
                'comandas as comandas_listas' => fn($q) =>
                    $q->where('estado', 'listo'),
            ])
            ->orderByRaw("nombre")
            ->get()
            ->map(function (Mesa $mesa) {
                $estado = 'libre';
                if ($mesa->comandas_activas > 0) {
                    $estado = 'ocupada';
                } elseif ($mesa->comandas_listas > 0) {
                    $estado = 'lista';
                }
                return array_merge($mesa->toArray(), ['estado' => $estado]);
            });

        return $this->success($mesas);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
            'nombre'     => ['required', 'string', 'max:60'],
            'capacidad'  => ['nullable', 'integer', 'min:1', 'max:999'],
        ]);

        $mesa = Mesa::create([
            'empresa_id' => $validated['empresa_id'],
            'nombre'     => $validated['nombre'],
            'capacidad'  => $validated['capacidad'] ?? null,
            'activo'     => true,
        ]);

        return $this->created($mesa);
    }

    public function update(Request $request, Mesa $mesa): JsonResponse
    {
        $validated = $request->validate([
            'nombre'    => ['sometimes', 'string', 'max:60'],
            'capacidad' => ['nullable', 'integer', 'min:1', 'max:999'],
            'activo'    => ['sometimes', 'boolean'],
        ]);

        $mesa->update($validated);

        return $this->success($mesa);
    }

    public function destroy(Mesa $mesa): JsonResponse
    {
        $activas = $mesa->comandas()->whereIn('estado', ['pendiente', 'en_preparacion', 'listo'])->exists();
        if ($activas) {
            return $this->error('No se puede eliminar una mesa con pedidos activos.', 409);
        }

        $mesa->update(['activo' => false]);

        return $this->noContent();
    }

    /** Comandas activas y listas para una mesa */
    public function comandas(Mesa $mesa): JsonResponse
    {
        $comandas = $mesa->comandas()
            ->whereIn('estado', ['pendiente', 'en_preparacion', 'listo'])
            ->with('detalles')
            ->orderBy('created_at')
            ->get()
            ->map(fn($c) => $this->mapComanda($c));

        return $this->success($comandas);
    }

    /** Factura todas las comandas en estado listo de la mesa */
    public function facturar(Request $request, Mesa $mesa): JsonResponse
    {
        $validated = $request->validate([
            'bodega_id'   => ['required', 'integer', 'exists:bodegas,id'],
            'metodo_pago' => ['required', 'in:efectivo,tarjeta,transferencia,mixto'],
            'cliente_id'  => ['nullable', 'integer', 'exists:clientes,id'],
            'descuento'   => ['nullable', 'numeric', 'min:0'],
            'impuesto'    => ['nullable', 'numeric', 'min:0'],
        ]);

        $comandasListas = $mesa->comandas()
            ->where('estado', 'listo')
            ->with(['detalles.receta.ingredientes.producto'])
            ->get();

        if ($comandasListas->isEmpty()) {
            return $this->error('No hay pedidos listos para cobrar en esta mesa.', 422);
        }

        try {
            $venta = DB::transaction(function () use ($mesa, $comandasListas, $validated, $request) {
                $descuento = (float) ($validated['descuento'] ?? 0);
                $impuesto  = (float) ($validated['impuesto'] ?? 0);

                // Número correlativo de factura
                $last = Venta::where('empresa_id', $mesa->empresa_id)
                    ->where('numero_factura', 'like', 'FAC-%')
                    ->lockForUpdate()
                    ->orderByDesc('id')
                    ->value('numero_factura');
                $sig           = $last ? ((int) substr($last, 4)) + 1 : 1;
                $numeroFactura = 'FAC-' . str_pad($sig, 4, '0', STR_PAD_LEFT);

                // Calcular subtotal total de todas las comandas
                $subtotal = $comandasListas->flatMap(fn($c) => $c->detalles)
                    ->sum(fn($d) => (float) $d->cantidad * (float) $d->precio_unitario);

                $venta = Venta::create([
                    'empresa_id'     => $mesa->empresa_id,
                    'bodega_id'      => $validated['bodega_id'],
                    'cliente_id'     => $validated['cliente_id'] ?? null,
                    'usuario_id'     => $request->user()->id,
                    'numero_factura' => $numeroFactura,
                    'fecha_venta'    => now()->toDateString(),
                    'subtotal'       => $subtotal,
                    'descuento'      => $descuento,
                    'impuesto'       => $impuesto,
                    'total'          => $subtotal - $descuento + $impuesto,
                    'estado'         => 'completada',
                    'metodo_pago'    => $validated['metodo_pago'],
                ]);

                // Pre-cargar costos
                $allDetalles  = $comandasListas->flatMap(fn($c) => $c->detalles);
                $productoIds  = $allDetalles->whereNotNull('producto_id')->pluck('producto_id')->unique();
                $costos       = $productoIds->isNotEmpty()
                    ? Producto::whereIn('id', $productoIds)->pluck('costo', 'id')
                    : collect();

                $recetaIds = $allDetalles->whereNotNull('receta_id')->pluck('receta_id')->unique();
                $recetas   = $recetaIds->isNotEmpty()
                    ? Receta::with('ingredientes.producto')->whereIn('id', $recetaIds)->get()->keyBy('id')
                    : collect();

                foreach ($allDetalles as $det) {
                    $esReceta = !empty($det->receta_id);
                    $costo    = $esReceta
                        ? ($recetas[$det->receta_id]?->ingredientes->sum(
                            fn($i) => (float) $i->cantidad * (float) ($i->producto?->costo ?? 0)
                          ) ?? 0)
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

                $comandasListas->each(fn($c) => $c->update(['estado' => 'cancelado']));

                return $venta;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $venta->load(['cliente', 'bodega', 'detalles.producto']);

        return $this->success($venta, 'Mesa cobrada correctamente.');
    }

    private function mapComanda(Comanda $c): array
    {
        return [
            'id'             => $c->id,
            'mesa_id'        => $c->mesa_id,
            'numero_comanda' => $c->numero_comanda,
            'mesa'           => $c->mesa,
            'estado'         => $c->estado,
            'observaciones'  => $c->observaciones,
            'created_at'     => $c->created_at?->toISOString(),
            'detalles'       => $c->relationLoaded('detalles')
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
