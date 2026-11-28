<?php

namespace App\Http\Controllers\Api;

use App\Models\CategoriaBanco;
use App\Models\CuentaBancaria;
use App\Models\Empresa;
use App\Models\MovimientoBanco;
use App\Models\TarjetaCredito;
use App\Services\BancoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BancoController extends ApiController
{
    public function __construct(private readonly BancoService $bancos) {}

    /* ── Cuentas ─────────────────────────────────────────────────── */
    public function index(Request $request): JsonResponse
    {
        $cuentas = CuentaBancaria::where('empresa_id', $request->integer('empresa_id'))
            ->when(! $request->boolean('todas'), fn($q) => $q->where('activo', true))
            ->orderBy('moneda')->orderBy('banco')->orderBy('nombre')
            ->get()->map(fn($c) => $this->cuenta($c));

        return $this->success([
            'cuentas' => $cuentas->values(),
            'totales' => $cuentas->where('activo', true)->groupBy('moneda')->map(fn($g) => round($g->sum('saldo'), 2)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $empresaId = $request->validate(['empresa_id' => ['required', 'integer', 'exists:empresas,id']])['empresa_id'];
        $c = CuentaBancaria::create($this->validarCuenta($request) + ['empresa_id' => $empresaId]);
        return $this->created($this->cuenta($c), 'Cuenta agregada.');
    }

    public function update(Request $request, CuentaBancaria $cuenta): JsonResponse
    {
        $this->verificar($request, $cuenta->empresa_id);
        $datos = $this->validarCuenta($request);
        if ($datos['moneda'] !== $cuenta->moneda && $cuenta->movimientos()->exists()) {
            return $this->error('La cuenta ya tiene movimientos; no se puede cambiar la moneda.', 422);
        }
        $cuenta->update($datos);
        return $this->success($this->cuenta($cuenta), 'Cuenta actualizada.');
    }

    /** Libro de la cuenta con saldo corrido. */
    public function movimientos(Request $request, CuentaBancaria $cuenta): JsonResponse
    {
        $this->verificar($request, $cuenta->empresa_id);
        $desde = $request->input('fecha_desde');
        $hasta = $request->input('fecha_hasta');
        $signo = "CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END";

        $saldoInicial = (float) $cuenta->saldo_inicial;
        if ($desde) {
            $saldoInicial += (float) $cuenta->movimientos()->where('anulado', false)->whereDate('fecha', '<', $desde)
                ->selectRaw("COALESCE(SUM({$signo}), 0) as s")->value('s');
        }

        $movs = $cuenta->movimientos()->with(['usuario:id,nombre', 'categoria:id,nombre'])
            ->when($desde, fn($q) => $q->whereDate('fecha', '>=', $desde))
            ->when($hasta, fn($q) => $q->whereDate('fecha', '<=', $hasta))
            ->when($request->filled('conciliado'), fn($q) => $q->where('conciliado', $request->boolean('conciliado')))
            ->orderBy('fecha')->orderBy('id')->get();

        $saldo = $saldoInicial;
        $lista = $movs->map(function ($m) use (&$saldo) {
            if (! $m->anulado) $saldo += $m->tipo === 'entrada' ? (float) $m->monto : -(float) $m->monto;
            return [
                'id' => $m->id, 'fecha' => $m->fecha->toDateString(), 'tipo' => $m->tipo, 'monto' => (float) $m->monto,
                'descripcion' => $m->descripcion, 'origen' => $m->origen, 'referencia' => $m->referencia,
                'categoria' => $m->categoria?->nombre, 'conciliado' => (bool) $m->conciliado, 'anulado' => (bool) $m->anulado,
                'usuario' => $m->usuario?->nombre, 'saldo' => round($saldo, 2),
            ];
        })->reverse()->values();

        $pendientes = $cuenta->movimientos()->where('anulado', false)->where('conciliado', false)
            ->selectRaw("COALESCE(SUM({$signo}), 0) as s, COUNT(*) as n")->first();

        return $this->success([
            'cuenta'        => $this->cuenta($cuenta),
            'saldo_inicial' => round($saldoInicial, 2),
            'movimientos'   => $lista,
            'sin_conciliar' => ['cantidad' => (int) $pendientes->n, 'neto' => round((float) $pendientes->s, 2)],
        ]);
    }

    public function movimiento(Request $request, CuentaBancaria $cuenta): JsonResponse
    {
        $this->verificar($request, $cuenta->empresa_id);
        $datos = $request->validate([
            'tipo'               => ['required', 'in:entrada,salida'],
            'monto'              => ['required', 'numeric', 'min:0.01'],
            'fecha'              => ['nullable', 'date', 'before_or_equal:today'],
            'descripcion'        => ['required', 'string', 'min:3', 'max:255'],
            'categoria_banco_id' => ['nullable', 'integer'],
            'referencia'         => ['nullable', 'string', 'max:100'],
        ]);
        return $this->ejecutar(fn() => $this->bancos->manual($cuenta, $datos, $request->user()->id), 'Movimiento registrado.');
    }

    public function depositoCaja(Request $request, CuentaBancaria $cuenta): JsonResponse
    {
        $this->verificar($request, $cuenta->empresa_id);
        $datos = $request->validate([
            'monto'      => ['required', 'numeric', 'min:0.01'],
            'fecha'      => ['nullable', 'date', 'before_or_equal:today'],
            'referencia' => ['nullable', 'string', 'max:100'],
        ]);
        return $this->ejecutar(fn() => $this->bancos->depositoCaja($cuenta, $datos, $request->user()->id), 'Depósito registrado.');
    }

    public function transferencia(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'cuenta_origen_id'  => ['required', 'integer'],
            'cuenta_destino_id' => ['required', 'integer'],
            'monto'             => ['required', 'numeric', 'min:0.01'],
            'monto_destino'     => ['nullable', 'numeric', 'min:0.01'],
            'fecha'             => ['nullable', 'date', 'before_or_equal:today'],
            'referencia'        => ['nullable', 'string', 'max:100'],
        ]);
        $origen  = CuentaBancaria::findOrFail($datos['cuenta_origen_id']);
        $destino = CuentaBancaria::findOrFail($datos['cuenta_destino_id']);
        $this->verificar($request, $origen->empresa_id);
        $this->verificar($request, $destino->empresa_id);

        return $this->ejecutar(fn() => $this->bancos->transferir($origen, $destino, $datos, $request->user()->id), 'Transferencia registrada.');
    }

    public function anular(Request $request, MovimientoBanco $movimiento): JsonResponse
    {
        $this->verificar($request, $movimiento->empresa_id);
        return $this->ejecutar(fn() => $this->bancos->anularMovimiento($movimiento), 'Movimiento anulado.');
    }

    public function conciliar(Request $request, MovimientoBanco $movimiento): JsonResponse
    {
        $this->verificar($request, $movimiento->empresa_id);
        $ok = $request->validate(['conciliado' => ['required', 'boolean']])['conciliado'];
        $movimiento->update(['conciliado' => $ok, 'conciliado_at' => $ok ? now() : null]);
        return $this->success(null);
    }

    /* ── Configuración: cuentas por defecto y categorías ──────────── */
    public function configuracion(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $this->bancos->categoriasIniciales($empresaId);

        return $this->success([
            'defectos'   => Empresa::find($empresaId)?->config_bancos ?? (object) [],
            'categorias' => CategoriaBanco::where('empresa_id', $empresaId)->orderBy('nombre')->get(['id', 'nombre', 'tipo', 'activo']),
        ]);
    }

    public function guardarConfiguracion(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'empresa_id'              => ['required', 'integer', 'exists:empresas,id'],
            'cuenta_tarjeta_id'       => ['nullable', 'integer'],
            'cuenta_transferencia_id' => ['nullable', 'integer'],
            'cuenta_pagos_id'         => ['nullable', 'integer'],
        ]);
        $empresaId = $datos['empresa_id'];
        unset($datos['empresa_id']);

        try {
            foreach ($datos as $id) $this->bancos->validar($empresaId, $id);
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }

        Empresa::findOrFail($empresaId)->update(['config_bancos' => array_filter($datos)]);
        return $this->success(array_filter($datos), 'Cuentas por defecto guardadas.');
    }

    public function guardarCategoria(Request $request, ?CategoriaBanco $categoria = null): JsonResponse
    {
        $datos = $request->validate([
            'empresa_id' => ['required', 'integer', 'exists:empresas,id'],
            'nombre'     => ['required', 'string', 'max:100'],
            'tipo'       => ['required', 'in:entrada,salida,ambos'],
            'activo'     => ['boolean'],
        ]);
        if ($categoria?->exists) {
            $this->verificar($request, $categoria->empresa_id);
            $categoria->update($datos);
        } else {
            $categoria = CategoriaBanco::create($datos);
        }
        return $this->success($categoria->only(['id', 'nombre', 'tipo', 'activo']));
    }

    /* ── Opciones para selectores (sin saldos) ───────────────────── */
    public function opcionesCuentas(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $cuentas = CuentaBancaria::where('empresa_id', $empresaId)->where('activo', true)
            ->when(! $request->boolean('todas_monedas'), fn($q) => $q->where('moneda', 'HNL'))
            ->orderBy('banco')->get();

        return $this->success([
            'cuentas'  => $cuentas->map(fn($c) => ['id' => $c->id, 'etiqueta' => $c->etiqueta(), 'moneda' => $c->moneda])->values(),
            'defectos' => Empresa::find($empresaId)?->config_bancos ?? (object) [],
        ]);
    }

    public function opcionesTarjetas(Request $request): JsonResponse
    {
        return $this->success(TarjetaCredito::where('empresa_id', $request->integer('empresa_id'))->where('activo', true)
            ->orderBy('banco')->get()
            ->map(fn($t) => \App\Http\Resources\TarjetaCreditoResource::resumen($t))->values());
    }

    /* ── Helpers ─────────────────────────────────────────────────── */
    private function ejecutar(callable $fn, string $mensaje): JsonResponse
    {
        try {
            DB::transaction($fn);
        } catch (\DomainException $e) {
            return $this->error($e->getMessage(), 422);
        }
        return $this->success(null, $mensaje);
    }

    private function verificar(Request $request, int $empresaId): void
    {
        abort_unless($request->user()->tienePermiso($empresaId, 'finanzas'), 404);
    }

    private function validarCuenta(Request $request): array
    {
        $d = $request->validate([
            'banco'               => ['required', 'string', 'max:100'],
            'nombre'              => ['required', 'string', 'max:100'],
            'tipo'                => ['required', 'in:corriente,ahorro'],
            'ultimos4'            => ['required', 'digits:4'],
            'moneda'              => ['required', 'in:' . implode(',', BancoService::MONEDAS)],
            'saldo_inicial'       => ['nullable', 'numeric'],
            'fecha_saldo_inicial' => ['nullable', 'date'],
            'comision_pos_pct'    => ['nullable', 'numeric', 'min:0', 'max:20'],
            'activo'              => ['boolean'],
        ], ['ultimos4.digits' => 'Escribe los últimos 4 dígitos de la cuenta.']);
        $d['saldo_inicial'] = $d['saldo_inicial'] ?? 0;
        return $d;
    }

    private function cuenta(CuentaBancaria $c): array
    {
        return [
            'id' => $c->id, 'banco' => $c->banco, 'nombre' => $c->nombre, 'tipo' => $c->tipo, 'ultimos4' => $c->ultimos4,
            'moneda' => $c->moneda, 'etiqueta' => $c->etiqueta(), 'saldo_inicial' => (float) $c->saldo_inicial,
            'fecha_saldo_inicial' => $c->fecha_saldo_inicial?->toDateString(),
            'comision_pos_pct' => $c->comision_pos_pct !== null ? (float) $c->comision_pos_pct : null,
            'activo' => (bool) $c->activo, 'saldo' => $c->saldo(),
        ];
    }
}
