<?php

namespace App\Http\Controllers\Api;

use App\Models\SesionCaja;
use App\Models\Venta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SesionCajaController extends ApiController
{
    /* ── Sesión activa + resumen en vivo ── */
    public function actual(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $sesion = SesionCaja::with('usuario')
            ->where('empresa_id', $empresaId)
            ->where('estado', 'abierta')
            ->latest('fecha_apertura')
            ->first();

        if (! $sesion) {
            return response()->json(['success' => true, 'data' => null]);
        }

        return response()->json([
            'success' => true,
            'data'    => array_merge($this->formatSesion($sesion), [
                'resumen' => $this->calcularResumen($sesion),
            ]),
        ]);
    }

    /* ── Abrir sesión ── */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'empresa_id'    => ['required', 'integer', 'exists:empresas,id'],
            'monto_inicial' => ['required', 'numeric', 'min:0'],
        ]);

        $abierta = SesionCaja::where('empresa_id', $validated['empresa_id'])
            ->where('estado', 'abierta')->exists();

        if ($abierta) {
            return $this->error('Ya hay una sesión de caja abierta.', 422);
        }

        $sesion = SesionCaja::create([
            'empresa_id'     => $validated['empresa_id'],
            'usuario_id'     => $request->user()->id,
            'monto_inicial'  => $validated['monto_inicial'],
            'estado'         => 'abierta',
            'fecha_apertura' => now(),
        ]);

        $sesion->load('usuario');

        return $this->created(array_merge($this->formatSesion($sesion), [
            'resumen' => $this->calcularResumen($sesion),
        ]));
    }

    /* ── Cerrar sesión ── */
    public function cerrar(Request $request, SesionCaja $sesion): JsonResponse
    {
        if ($sesion->estado !== 'abierta') {
            return $this->error('Esta sesión ya está cerrada.', 422);
        }

        $validated = $request->validate([
            'monto_cierre'  => ['required', 'numeric', 'min:0'],
            'observaciones' => ['nullable', 'string', 'max:1000'],
        ]);

        $resumen      = $this->calcularResumen($sesion);
        $efectivoEsperado = $sesion->monto_inicial + $resumen['por_metodo']['efectivo'];
        $diferencia   = $validated['monto_cierre'] - $efectivoEsperado;

        $sesion->update([
            'monto_cierre'       => $validated['monto_cierre'],
            'diferencia'         => $diferencia,
            'total_ventas'       => $resumen['total_ventas'],
            'total_efectivo'     => $resumen['por_metodo']['efectivo'],
            'total_tarjeta'      => $resumen['por_metodo']['tarjeta'],
            'total_transferencia' => $resumen['por_metodo']['transferencia'],
            'total_mixto'        => $resumen['por_metodo']['mixto'],
            'cantidad_ventas'    => $resumen['cantidad_ventas'],
            'estado'             => 'cerrada',
            'fecha_cierre'       => now(),
            'observaciones'      => $validated['observaciones'] ?? null,
        ]);

        $sesion->load('usuario');

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada correctamente.',
            'data'    => $this->formatSesion($sesion),
        ]);
    }

    /* ── Historial ── */
    public function index(Request $request): JsonResponse
    {
        $data = SesionCaja::with('usuario')
            ->where('empresa_id', $request->integer('empresa_id'))
            ->orderByDesc('fecha_apertura')
            ->paginate($request->integer('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $data->map(fn($s) => $this->formatSesion($s)),
            'meta'    => ['total' => $data->total(), 'last_page' => $data->lastPage(), 'current_page' => $data->currentPage()],
        ]);
    }

    /* ── Detalle de sesión cerrada ── */
    public function show(SesionCaja $sesion): JsonResponse
    {
        $sesion->load('usuario');
        $data = $this->formatSesion($sesion);
        if ($sesion->estado === 'abierta') {
            $data['resumen'] = $this->calcularResumen($sesion);
        }
        return response()->json(['success' => true, 'data' => $data]);
    }

    /* ── Helpers ── */
    private function calcularResumen(SesionCaja $sesion): array
    {
        $ventas = Venta::where('empresa_id', $sesion->empresa_id)
            ->where('estado', 'completada')
            ->where('created_at', '>=', $sesion->fecha_apertura)
            ->when($sesion->fecha_cierre, fn($q) => $q->where('created_at', '<=', $sesion->fecha_cierre))
            ->selectRaw('metodo_pago, SUM(total) as total, COUNT(*) as cantidad')
            ->groupBy('metodo_pago')
            ->get()
            ->keyBy('metodo_pago');

        $por_metodo = [
            'efectivo'      => (float) ($ventas['efectivo']->total      ?? 0),
            'tarjeta'       => (float) ($ventas['tarjeta']->total       ?? 0),
            'transferencia' => (float) ($ventas['transferencia']->total  ?? 0),
            'mixto'         => (float) ($ventas['mixto']->total         ?? 0),
        ];

        $totalVentas   = array_sum($por_metodo);
        $cantidadTotal = $ventas->sum('cantidad');

        return [
            'total_ventas'      => $totalVentas,
            'cantidad_ventas'   => (int) $cantidadTotal,
            'por_metodo'        => $por_metodo,
            'efectivo_esperado' => (float) $sesion->monto_inicial + $por_metodo['efectivo'],
        ];
    }

    private function formatSesion(SesionCaja $s): array
    {
        return [
            'id'                  => $s->id,
            'empresa_id'          => $s->empresa_id,
            'usuario'             => $s->usuario ? ['id' => $s->usuario->id, 'nombre' => $s->usuario->nombre] : null,
            'monto_inicial'       => (float) $s->monto_inicial,
            'monto_cierre'        => $s->monto_cierre !== null ? (float) $s->monto_cierre : null,
            'diferencia'          => $s->diferencia !== null ? (float) $s->diferencia : null,
            'total_ventas'        => $s->total_ventas !== null ? (float) $s->total_ventas : null,
            'total_efectivo'      => $s->total_efectivo !== null ? (float) $s->total_efectivo : null,
            'total_tarjeta'       => $s->total_tarjeta !== null ? (float) $s->total_tarjeta : null,
            'total_transferencia' => $s->total_transferencia !== null ? (float) $s->total_transferencia : null,
            'total_mixto'         => $s->total_mixto !== null ? (float) $s->total_mixto : null,
            'cantidad_ventas'     => $s->cantidad_ventas,
            'estado'              => $s->estado,
            'fecha_apertura'      => $s->fecha_apertura?->toDateTimeString(),
            'fecha_cierre'        => $s->fecha_cierre?->toDateTimeString(),
            'observaciones'       => $s->observaciones,
        ];
    }
}
