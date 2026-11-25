<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\TarjetaCreditoResource;
use App\Models\CargoTarjeta;
use App\Models\PagoTarjeta;
use App\Models\TarjetaCredito;
use App\Services\TarjetaService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TarjetaCreditoController extends ApiController
{
    public function __construct(private readonly TarjetaService $tarjetas) {}

    /** Tarjetas con saldo, disponible y lo cargado en el período actual. */
    public function index(Request $request): JsonResponse
    {
        $tarjetas = TarjetaCredito::where('empresa_id', $request->integer('empresa_id'))
            ->when(! $request->boolean('todas'), fn($q) => $q->where('activo', true))
            ->orderBy('banco')->orderBy('nombre')
            ->get();

        return $this->success($tarjetas->map(fn($t) => $this->conSaldos($t))->values());
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validarTarjeta($request) + ['empresa_id' => $request->validate(['empresa_id' => ['required', 'integer', 'exists:empresas,id']])['empresa_id']];
        $t = TarjetaCredito::create($datos);
        return $this->created($this->conSaldos($t), 'Tarjeta agregada.');
    }

    public function update(Request $request, TarjetaCredito $tarjeta): JsonResponse
    {
        $this->verificar($request, $tarjeta);
        $tarjeta->update($this->validarTarjeta($request));
        return $this->success($this->conSaldos($tarjeta), 'Tarjeta actualizada.');
    }

    /** Movimientos (cargos y pagos) con saldo corrido, filtrados por fechas. */
    public function movimientos(Request $request, TarjetaCredito $tarjeta): JsonResponse
    {
        $this->verificar($request, $tarjeta);
        $desde = $request->input('fecha_desde');
        $hasta = $request->input('fecha_hasta');

        $saldoInicial = 0.0;
        if ($desde) {
            $saldoInicial = (float) $tarjeta->cargos()->where('anulado', false)->whereDate('fecha', '<', $desde)->sum('monto')
                          - (float) $tarjeta->pagos()->where('anulado', false)->whereDate('fecha', '<', $desde)->sum('monto');
        }

        $cargos = $tarjeta->cargos()->with('usuario:id,nombre')
            ->when($desde, fn($q) => $q->whereDate('fecha', '>=', $desde))
            ->when($hasta, fn($q) => $q->whereDate('fecha', '<=', $hasta))
            ->get()->map(fn($c) => [
                'tipo' => 'cargo', 'id' => $c->id, 'fecha' => $c->fecha->toDateString(), 'monto' => (float) $c->monto,
                'descripcion' => $c->descripcion, 'origen' => $c->origen, 'anulado' => (bool) $c->anulado,
                'usuario' => $c->usuario?->nombre, 'creado' => $c->created_at?->toDateTimeString(),
            ]);
        $pagos = $tarjeta->pagos()->with('usuario:id,nombre')
            ->when($desde, fn($q) => $q->whereDate('fecha', '>=', $desde))
            ->when($hasta, fn($q) => $q->whereDate('fecha', '<=', $hasta))
            ->get()->map(fn($p) => [
                'tipo' => 'pago', 'id' => $p->id, 'fecha' => $p->fecha->toDateString(), 'monto' => (float) $p->monto,
                'descripcion' => 'Pago al banco' . ($p->referencia ? " · ref. {$p->referencia}" : '') . ($p->observaciones ? " · {$p->observaciones}" : ''),
                'origen' => $p->metodo_pago . ($p->desde_caja ? ' (caja)' : ''), 'anulado' => (bool) $p->anulado,
                'usuario' => $p->usuario?->nombre, 'creado' => $p->created_at?->toDateTimeString(),
            ]);

        $saldo = $saldoInicial;
        $movs  = $cargos->concat($pagos)->sortBy([['fecha', 'asc'], ['creado', 'asc']])->values()
            ->map(function ($m) use (&$saldo) {
                if (! $m['anulado']) $saldo += $m['tipo'] === 'cargo' ? $m['monto'] : -$m['monto'];
                return $m + ['saldo' => round($saldo, 2)];
            })->reverse()->values();

        return $this->success([
            'tarjeta'       => $this->conSaldos($tarjeta),
            'saldo_inicial' => round($saldoInicial, 2),
            'movimientos'   => $movs,
        ]);
    }

    public function pagar(Request $request, TarjetaCredito $tarjeta): JsonResponse
    {
        $this->verificar($request, $tarjeta);
        $datos = $request->validate([
            'monto'         => ['required', 'numeric', 'min:0.01'],
            'fecha'         => ['nullable', 'date', 'before_or_equal:today'],
            'metodo_pago'   => ['required', 'string', 'in:transferencia,efectivo,debito,cheque'],
            'desde_caja'    => ['nullable', 'boolean'],
            'referencia'    => ['nullable', 'string', 'max:100'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ]);
        DB::transaction(fn() => $this->tarjetas->registrarPago($tarjeta, $datos, $request->user()->id));
        return $this->created($this->conSaldos($tarjeta->fresh()), 'Pago registrado.');
    }

    public function cargo(Request $request, TarjetaCredito $tarjeta): JsonResponse
    {
        $this->verificar($request, $tarjeta);
        $datos = $request->validate([
            'monto'       => ['required', 'numeric', 'not_in:0'],
            'fecha'       => ['nullable', 'date', 'before_or_equal:today'],
            'descripcion' => ['required', 'string', 'min:3', 'max:255'],
        ]);
        DB::transaction(fn() => $this->tarjetas->cargoManual($tarjeta, $datos, $request->user()->id));
        return $this->created($this->conSaldos($tarjeta->fresh()), 'Cargo registrado.');
    }

    public function anularPago(Request $request, PagoTarjeta $pago): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($pago->empresa_id, 'compras'), 404);
        try {
            DB::transaction(fn() => $this->tarjetas->anularPago($pago, $request->user()->id));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success(null, 'Pago anulado.');
    }

    public function anularCargo(Request $request, CargoTarjeta $cargo): JsonResponse
    {
        abort_unless($request->user()->tienePermiso($cargo->empresa_id, 'compras'), 404);
        try {
            DB::transaction(fn() => $this->tarjetas->anularCargo($cargo));
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success(null, 'Cargo anulado.');
    }

    /* ── Helpers ──────────────────────────────────────────────────── */
    private function verificar(Request $request, TarjetaCredito $t): void
    {
        abort_unless($request->user()->tienePermiso($t->empresa_id, 'compras'), 404);
    }

    private function validarTarjeta(Request $request): array
    {
        return $request->validate([
            'nombre'    => ['required', 'string', 'max:100'],
            'banco'     => ['required', 'string', 'max:100'],
            'ultimos4'  => ['required', 'digits:4'],
            'dia_corte' => ['nullable', 'integer', 'min:1', 'max:31'],
            'dia_pago'  => ['nullable', 'integer', 'min:1', 'max:31'],
            'limite'    => ['nullable', 'numeric', 'min:0'],
            'activo'    => ['boolean'],
        ], ['ultimos4.digits' => 'Escribe los últimos 4 dígitos de la tarjeta.']);
    }

    /** Fecha con ese día del mes (ajustada a fin de mes). */
    private static function diaDe(Carbon $mes, int $dia): Carbon
    {
        return $mes->copy()->day(min($dia, $mes->daysInMonth));
    }

    private function conSaldos(TarjetaCredito $t): array
    {
        $saldo = $t->saldo();
        $hoy   = today();

        $ultimoCorte = $proximoCorte = $fechaPago = null;
        $periodo = null;
        if ($t->dia_corte) {
            $esteMes      = self::diaDe($hoy->copy()->startOfMonth(), $t->dia_corte);
            $ultimoCorte  = $esteMes->lte($hoy) ? $esteMes : self::diaDe($hoy->copy()->startOfMonth()->subMonth(), $t->dia_corte);
            $proximoCorte = self::diaDe($ultimoCorte->copy()->startOfMonth()->addMonth(), $t->dia_corte);
            $periodo = round((float) $t->cargos()->where('anulado', false)->whereDate('fecha', '>', $ultimoCorte)->sum('monto'), 2);
            if ($t->dia_pago) {
                $mesPago   = $t->dia_pago > $t->dia_corte ? $ultimoCorte->copy()->startOfMonth() : $ultimoCorte->copy()->startOfMonth()->addMonth();
                $fechaPago = self::diaDe($mesPago, $t->dia_pago);
            }
        }

        return (new TarjetaCreditoResource($t))->resolve() + [
            'saldo'             => $saldo,
            'disponible'        => $t->limite !== null ? round((float) $t->limite - $saldo, 2) : null,
            'ultimo_corte'      => $ultimoCorte?->toDateString(),
            'proximo_corte'     => $proximoCorte?->toDateString(),
            'fecha_pago'        => $fechaPago?->toDateString(),
            'cargado_periodo'   => $periodo,
        ];
    }
}
