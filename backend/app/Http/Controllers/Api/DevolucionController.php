<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\DevolucionCompraResource;
use App\Http\Resources\DevolucionVentaResource;
use App\Models\Compra;
use App\Models\DevolucionCompra;
use App\Models\DevolucionVenta;
use App\Models\Venta;
use App\Services\DevolucionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DevolucionController extends ApiController
{
    public function __construct(private readonly DevolucionService $devoluciones) {}

    /* ── Clientes ─────────────────────────────────────────────────── */
    public function devolverVenta(Request $request, Venta $venta): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($venta->empresa_id, 'ventas'), 404);
        $datos = $this->validar($request, DevolucionService::METODOS_REEMBOLSO_CLIENTE);

        try {
            $dev = DB::transaction(fn() => $this->devoluciones->devolverVenta(
                $venta, $this->lineas($datos), $datos, $request->user()->id,
            ));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->created(new DevolucionVentaResource($this->cargarVenta($dev)), "Devolución {$dev->numero} registrada.");
    }

    public function indexVenta(Request $request): JsonResponse
    {
        $data = DevolucionVenta::with(['venta:id,numero_factura', 'cliente:id,nombre,rtn', 'usuario:id,nombre'])
            ->where('empresa_id', $request->integer('empresa_id'))
            ->when($request->filled('search'), fn($q) => $q->where(fn($w) => $w
                ->where('numero', 'ilike', "%{$request->search}%")
                ->orWhereHas('venta', fn($v) => $v->where('numero_factura', 'ilike', "%{$request->search}%"))
                ->orWhereHas('cliente', fn($c) => $c->where('nombre', 'ilike', "%{$request->search}%"))))
            ->when($request->filled('fecha_desde'), fn($q) => $q->whereDate('fecha', '>=', $request->fecha_desde))
            ->when($request->filled('fecha_hasta'), fn($q) => $q->whereDate('fecha', '<=', $request->fecha_hasta))
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return $this->paginado($data, DevolucionVentaResource::class);
    }

    public function showVenta(Request $request, DevolucionVenta $devolucion): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($devolucion->empresa_id, 'ventas'), 404);
        return $this->success(new DevolucionVentaResource($this->cargarVenta($devolucion)));
    }

    /* ── Proveedores ──────────────────────────────────────────────── */
    public function devolverCompra(Request $request, Compra $compra): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($compra->empresa_id, 'compras'), 404);
        $datos = $this->validar($request, DevolucionService::METODOS_REEMBOLSO_PROVEEDOR);

        try {
            $dev = DB::transaction(fn() => $this->devoluciones->devolverCompra(
                $compra, $this->lineas($datos), $datos, $request->user()->id,
            ));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->created(new DevolucionCompraResource($this->cargarCompra($dev)), "Devolución {$dev->numero} registrada.");
    }

    public function indexCompra(Request $request): JsonResponse
    {
        $data = DevolucionCompra::with(['compra:id,numero_factura', 'proveedor:id,nombre,rtn', 'usuario:id,nombre'])
            ->where('empresa_id', $request->integer('empresa_id'))
            ->when($request->filled('search'), fn($q) => $q->where(fn($w) => $w
                ->where('numero', 'ilike', "%{$request->search}%")
                ->orWhereHas('compra', fn($v) => $v->where('numero_factura', 'ilike', "%{$request->search}%"))
                ->orWhereHas('proveedor', fn($c) => $c->where('nombre', 'ilike', "%{$request->search}%"))))
            ->when($request->filled('fecha_desde'), fn($q) => $q->whereDate('fecha', '>=', $request->fecha_desde))
            ->when($request->filled('fecha_hasta'), fn($q) => $q->whereDate('fecha', '<=', $request->fecha_hasta))
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return $this->paginado($data, DevolucionCompraResource::class);
    }

    public function showCompra(Request $request, DevolucionCompra $devolucion): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($devolucion->empresa_id, 'compras'), 404);
        return $this->success(new DevolucionCompraResource($this->cargarCompra($devolucion)));
    }

    /* ── Helpers ──────────────────────────────────────────────────── */
    private function validar(Request $request, array $metodos): array
    {
        return $request->validate([
            'motivo'              => ['required', 'string', 'min:3', 'max:500'],
            'fecha'               => ['nullable', 'date', 'before_or_equal:today'],
            'reembolso_metodo'    => ['nullable', 'string', 'in:' . implode(',', $metodos)],
            'desde_caja'          => ['nullable', 'boolean'],
            'lineas'              => ['required', 'array', 'min:1'],
            'lineas.*.detalle_id' => ['required', 'integer'],
            'lineas.*.cantidad'   => ['required', 'numeric', 'min:0'],
        ], [
            'motivo.required' => 'Escribe el motivo de la devolución.',
        ]);
    }

    private function lineas(array $datos): array
    {
        $lineas = [];
        foreach ($datos['lineas'] as $l) {
            $lineas[(int) $l['detalle_id']] = ($lineas[(int) $l['detalle_id']] ?? 0) + (float) $l['cantidad'];
        }
        return $lineas;
    }

    private function cargarVenta(DevolucionVenta $d): DevolucionVenta
    {
        return $d->load(['venta:id,numero_factura', 'cliente:id,nombre,rtn', 'bodega:id,nombre', 'usuario:id,nombre', 'detalles.producto:id,nombre,codigo', 'detalles.receta:id,nombre']);
    }

    private function cargarCompra(DevolucionCompra $d): DevolucionCompra
    {
        return $d->load(['compra:id,numero_factura', 'proveedor:id,nombre,rtn', 'bodega:id,nombre', 'usuario:id,nombre', 'detalles.producto:id,nombre,codigo']);
    }

    private function paginado($data, string $resource): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => $resource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }
}
