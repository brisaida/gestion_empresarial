<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\CompraResource;
use App\Http\Resources\PagoCompraResource;
use App\Models\Compra;
use App\Models\Empresa;
use App\Models\PagoCompra;
use App\Models\Proveedor;
use App\Services\CuentasPorPagarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CuentasPorPagarController extends ApiController
{
    public function __construct(private readonly CuentasPorPagarService $cxp) {}

    /* ── Resumen por proveedor con antigüedad de saldos ───────────── */
    public function resumen(Request $request): JsonResponse
    {
        $compras = Compra::with('proveedor:id,nombre,rtn,telefono')
            ->where('empresa_id', $request->integer('empresa_id'))
            ->creditoPendiente()
            ->when($request->filled('search'), fn($q) => $q->whereHas('proveedor',
                fn($p) => $p->where('nombre', 'ilike', "%{$request->search}%")->orWhere('rtn', 'ilike', "%{$request->search}%")))
            ->get(['id', 'proveedor_id', 'fecha_compra', 'fecha_vencimiento', 'saldo_pendiente', 'total']);

        $proveedores = $compras->groupBy('proveedor_id')->map(function (Collection $facturas) {
            $p = $facturas->first()->proveedor;
            return [
                'proveedor_id'  => $p?->id,
                'nombre'        => $p?->nombre ?? '— Sin proveedor —',
                'rtn'           => $p?->rtn,
                'telefono'      => $p?->telefono,
                'facturas'      => $facturas->count(),
                'vence_primero' => $facturas->min('fecha_vencimiento')?->toDateString(),
                ...$this->antiguedad($facturas),
            ];
        })->sortByDesc('vencido')->values();

        $proximas = $compras->filter(fn($c) => $c->fecha_vencimiento && $c->fecha_vencimiento->between(today(), today()->addDays(7)));

        return $this->success([
            'totales' => [
                'proveedores'   => $proveedores->count(),
                'facturas'      => $compras->count(),
                'vence_7_dias'  => round((float) $proximas->sum('saldo_pendiente'), 2),
                ...$this->antiguedad($compras),
            ],
            'proveedores' => $proveedores,
        ]);
    }

    /* ── Estado de cuenta con un proveedor ────────────────────────── */
    public function estadoCuenta(Request $request, Proveedor $proveedor): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($proveedor->empresa_id, 'compras'), 404);

        $pendientes = Compra::where('proveedor_id', $proveedor->id)
            ->creditoPendiente()
            ->orderBy('fecha_vencimiento')->orderBy('id')
            ->get();

        $pagos = PagoCompra::with(['compra:id,numero_factura', 'proveedor:id,nombre', 'usuario:id,nombre'])
            ->where('proveedor_id', $proveedor->id)
            ->orderByDesc('fecha')->orderByDesc('id')
            ->limit(100)
            ->get();

        return $this->success([
            'proveedor' => [
                'id'           => $proveedor->id,
                'nombre'       => $proveedor->nombre,
                'rtn'          => $proveedor->rtn,
                'telefono'     => $proveedor->telefono,
                'correo'       => $proveedor->correo,
                'dias_credito' => CuentasPorPagarService::diasPara($proveedor, Empresa::find($proveedor->empresa_id)),
            ],
            'resumen'  => ['facturas' => $pendientes->count(), ...$this->antiguedad($pendientes)],
            'facturas' => CompraResource::collection($pendientes),
            'pagos'    => PagoCompraResource::collection($pagos),
        ]);
    }

    /* ── Historial de pagos ───────────────────────────────────────── */
    public function pagos(Request $request): JsonResponse
    {
        $data = PagoCompra::with(['compra:id,numero_factura', 'proveedor:id,nombre', 'usuario:id,nombre'])
            ->where('empresa_id', $request->integer('empresa_id'))
            ->when($request->filled('proveedor_id'), fn($q) => $q->where('proveedor_id', $request->integer('proveedor_id')))
            ->when($request->filled('fecha_desde'), fn($q) => $q->whereDate('fecha', '>=', $request->fecha_desde))
            ->when($request->filled('fecha_hasta'), fn($q) => $q->whereDate('fecha', '<=', $request->fecha_hasta))
            ->orderByDesc('fecha')->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data'    => PagoCompraResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    /* ── Pago a una factura ───────────────────────────────────────── */
    public function pagar(Request $request, Compra $compra): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($compra->empresa_id, 'compras'), 404);
        $datos = $this->validarPago($request);

        try {
            $pago = DB::transaction(fn() => $this->cxp->registrarPago($compra, $datos, $request->user()->id));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $pago->load(['compra', 'proveedor', 'usuario']);
        return $this->created(new PagoCompraResource($pago));
    }

    /** Pago general a un proveedor: se reparte desde la factura que vence primero. */
    public function pagarProveedor(Request $request, Proveedor $proveedor): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($proveedor->empresa_id, 'compras'), 404);
        $datos = $this->validarPago($request);

        try {
            $pagos = DB::transaction(function () use ($proveedor, $datos, $request) {
                $restante = round((float) $datos['monto'], 2);
                $facturas = Compra::where('proveedor_id', $proveedor->id)->creditoPendiente()
                    ->orderBy('fecha_vencimiento')->orderBy('id')->lockForUpdate()->get();

                if ($facturas->isEmpty()) {
                    throw new \DomainException("No le debes nada a {$proveedor->nombre}.");
                }
                $deuda = round((float) $facturas->sum('saldo_pendiente'), 2);
                if ($restante > $deuda) {
                    throw new \DomainException(sprintf('El pago (L %s) es mayor que lo que le debes al proveedor (L %s).',
                        number_format($restante, 2), number_format($deuda, 2)));
                }

                $creados = collect();
                foreach ($facturas as $compra) {
                    if ($restante <= 0) break;
                    $monto = min($restante, round((float) $compra->saldo_pendiente, 2));
                    $creados->push($this->cxp->registrarPago($compra, [...$datos, 'monto' => $monto], $request->user()->id));
                    $restante = round($restante - $monto, 2);
                }
                return $creados;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $pagos->each->load(['compra', 'proveedor', 'usuario']);
        return $this->created(PagoCompraResource::collection($pagos));
    }

    public function anular(Request $request, PagoCompra $pago): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($pago->empresa_id, 'compras'), 404);

        try {
            $pago = DB::transaction(fn() => $this->cxp->anularPago($pago, $request->user()->id));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $pago->load(['compra', 'proveedor', 'usuario']);
        return $this->success(new PagoCompraResource($pago), 'Pago anulado.');
    }

    /* ── Helpers ──────────────────────────────────────────────────── */
    private function validarPago(Request $request): array
    {
        return $request->validate([
            'monto'         => ['required', 'numeric', 'min:0.01'],
            'fecha'         => ['nullable', 'date', 'before_or_equal:today'],
            'metodo_pago'   => ['required', 'string', 'in:' . implode(',', CuentasPorPagarService::METODOS_PAGO)],
            'desde_caja'    => ['nullable', 'boolean'],
            'referencia'    => ['nullable', 'string', 'max:100'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ]);
    }

    private function antiguedad(Collection $compras): array
    {
        $hoy = today();
        $r = ['saldo' => 0.0, 'al_dia' => 0.0, 'vencido' => 0.0, 'd1_30' => 0.0, 'd31_60' => 0.0, 'd61_90' => 0.0, 'd90_mas' => 0.0];

        foreach ($compras as $c) {
            $saldo = (float) $c->saldo_pendiente;
            $r['saldo'] += $saldo;
            $atraso = $c->fecha_vencimiento && $c->fecha_vencimiento->lt($hoy) ? (int) $c->fecha_vencimiento->diffInDays($hoy) : 0;

            if ($atraso === 0) { $r['al_dia'] += $saldo; continue; }
            $r['vencido'] += $saldo;
            $r[match (true) { $atraso <= 30 => 'd1_30', $atraso <= 60 => 'd31_60', $atraso <= 90 => 'd61_90', default => 'd90_mas' }] += $saldo;
        }

        return array_map(fn($v) => round($v, 2), $r);
    }
}
