<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AbonoVentaResource;
use App\Http\Resources\VentaResource;
use App\Models\AbonoVenta;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\Venta;
use App\Services\CreditoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CuentasPorCobrarController extends ApiController
{
    public function __construct(private readonly CreditoService $credito) {}

    /* ── Resumen por cliente con antigüedad de saldos ─────────────── */
    public function resumen(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $ventas = Venta::with('cliente:id,nombre,rtn,telefono,limite_credito')
            ->where('empresa_id', $empresaId)
            ->creditoPendiente()
            ->when($request->filled('search'), fn($q) => $q->whereHas('cliente',
                fn($c) => $c->where('nombre', 'ilike', "%{$request->search}%")->orWhere('rtn', 'ilike', "%{$request->search}%")))
            ->get(['id', 'cliente_id', 'fecha_venta', 'fecha_vencimiento', 'saldo_pendiente', 'total']);

        $clientes = $ventas->groupBy('cliente_id')->map(function (Collection $facturas) {
            $c = $facturas->first()->cliente;
            return [
                'cliente_id'      => $c?->id,
                'nombre'          => $c?->nombre ?? '— Sin cliente —',
                'rtn'             => $c?->rtn,
                'telefono'        => $c?->telefono,
                'limite_credito'  => $c?->limite_credito !== null ? (float) $c->limite_credito : null,
                'facturas'        => $facturas->count(),
                'vence_primero'   => $facturas->min('fecha_vencimiento')?->toDateString(),
                ...$this->antiguedad($facturas),
            ];
        })->sortByDesc('vencido')->values();

        return $this->success([
            'totales'  => ['clientes' => $clientes->count(), 'facturas' => $ventas->count(), ...$this->antiguedad($ventas)],
            'clientes' => $clientes,
        ]);
    }

    /* ── Estado de cuenta de un cliente ───────────────────────────── */
    public function estadoCuenta(Request $request, Cliente $cliente): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($cliente->empresa_id, 'finanzas'), 404);

        $pendientes = Venta::where('cliente_id', $cliente->id)
            ->creditoPendiente()
            ->orderBy('fecha_vencimiento')->orderBy('id')
            ->get();

        $abonos = AbonoVenta::with(['venta:id,numero_factura', 'cliente:id,nombre', 'usuario:id,nombre'])
            ->where('cliente_id', $cliente->id)
            ->orderByDesc('fecha')->orderByDesc('id')
            ->limit(100)
            ->get();

        $empresa = Empresa::find($cliente->empresa_id);

        return $this->success([
            'cliente' => [
                'id'             => $cliente->id,
                'nombre'         => $cliente->nombre,
                'rtn'            => $cliente->rtn,
                'telefono'       => $cliente->telefono,
                'correo'         => $cliente->correo,
                'direccion'      => $cliente->direccion,
                'limite_credito' => $cliente->limite_credito !== null ? (float) $cliente->limite_credito : null,
                'dias_credito'   => CreditoService::diasPara($cliente, $empresa),
            ],
            'resumen'  => ['facturas' => $pendientes->count(), ...$this->antiguedad($pendientes)],
            'facturas' => VentaResource::collection($pendientes),
            'abonos'   => AbonoVentaResource::collection($abonos),
        ]);
    }

    /* ── Historial de abonos (recibos) ────────────────────────────── */
    public function abonos(Request $request): JsonResponse
    {
        $query = AbonoVenta::with(['venta:id,numero_factura', 'cliente:id,nombre', 'usuario:id,nombre'])
            ->where('empresa_id', $request->integer('empresa_id'))
            ->when($request->filled('cliente_id'), fn($q) => $q->where('cliente_id', $request->integer('cliente_id')))
            ->when($request->filled('fecha_desde'), fn($q) => $q->whereDate('fecha', '>=', $request->fecha_desde))
            ->when($request->filled('fecha_hasta'), fn($q) => $q->whereDate('fecha', '<=', $request->fecha_hasta));

        $data = $query->orderByDesc('fecha')->orderByDesc('id')->paginate($request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data'    => AbonoVentaResource::collection($data),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    /* ── Abono a una factura ──────────────────────────────────────── */
    public function abonar(Request $request, Venta $venta): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($venta->empresa_id, 'ventas|finanzas'), 404);
        $datos = $this->validarAbono($request);

        try {
            $abono = DB::transaction(fn() => $this->credito->registrarAbono($venta, $datos, $request->user()->id));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $abono->load(['venta', 'cliente', 'usuario']);
        return $this->created(new AbonoVentaResource($abono));
    }

    /**
     * Abono general de un cliente: se reparte entre sus facturas pendientes,
     * de la que vence primero a la más reciente. Crea un abono por factura.
     */
    public function abonarCliente(Request $request, Cliente $cliente): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($cliente->empresa_id, 'ventas|finanzas'), 404);
        $datos = $this->validarAbono($request);

        try {
            $abonos = DB::transaction(function () use ($cliente, $datos, $request) {
                $restante = round((float) $datos['monto'], 2);
                $facturas = Venta::where('cliente_id', $cliente->id)->creditoPendiente()
                    ->orderBy('fecha_vencimiento')->orderBy('id')->lockForUpdate()->get();

                $deuda = round((float) $facturas->sum('saldo_pendiente'), 2);
                if ($facturas->isEmpty()) {
                    throw new \DomainException("{$cliente->nombre} no tiene saldo pendiente.");
                }
                if ($restante > $deuda) {
                    throw new \DomainException(sprintf('El abono (L %s) es mayor que lo que debe el cliente (L %s).',
                        number_format($restante, 2), number_format($deuda, 2)));
                }

                $creados = collect();
                foreach ($facturas as $venta) {
                    if ($restante <= 0) break;
                    $monto = min($restante, round((float) $venta->saldo_pendiente, 2));
                    $creados->push($this->credito->registrarAbono($venta, [...$datos, 'monto' => $monto], $request->user()->id));
                    $restante = round($restante - $monto, 2);
                }
                return $creados;
            });
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $abonos->each->load(['venta', 'cliente', 'usuario']);
        return $this->created(AbonoVentaResource::collection($abonos));
    }

    public function anular(Request $request, AbonoVenta $abono): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($abono->empresa_id, 'finanzas'), 404);

        try {
            $abono = DB::transaction(fn() => $this->credito->anularAbono($abono, $request->user()->id));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $abono->load(['venta', 'cliente', 'usuario']);
        return $this->success(new AbonoVentaResource($abono), 'Abono anulado.');
    }

    /* ── Helpers ──────────────────────────────────────────────────── */
    private function validarAbono(Request $request): array
    {
        return $request->validate([
            'monto'         => ['required', 'numeric', 'min:0.01'],
            'fecha'         => ['nullable', 'date', 'before_or_equal:today'],
            'metodo_pago'   => ['required', 'string', 'in:efectivo,tarjeta,transferencia,cheque'],
            'cuenta_bancaria_id' => ['nullable', 'integer'],
            'referencia'    => ['nullable', 'string', 'max:100'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ]);
    }

    /** Saldo total, vencido y por días de atraso. */
    private function antiguedad(Collection $ventas): array
    {
        $hoy = today();
        $r = ['saldo' => 0.0, 'al_dia' => 0.0, 'vencido' => 0.0, 'd1_30' => 0.0, 'd31_60' => 0.0, 'd61_90' => 0.0, 'd90_mas' => 0.0];

        foreach ($ventas as $v) {
            $saldo = (float) $v->saldo_pendiente;
            $r['saldo'] += $saldo;
            $atraso = $v->fecha_vencimiento && $v->fecha_vencimiento->lt($hoy) ? (int) $v->fecha_vencimiento->diffInDays($hoy) : 0;

            if ($atraso === 0) { $r['al_dia'] += $saldo; continue; }
            $r['vencido'] += $saldo;
            $r[match (true) { $atraso <= 30 => 'd1_30', $atraso <= 60 => 'd31_60', $atraso <= 90 => 'd61_90', default => 'd90_mas' }] += $saldo;
        }

        return array_map(fn($v) => round($v, 2), $r);
    }
}
