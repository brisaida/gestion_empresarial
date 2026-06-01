<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReporteController extends ApiController
{
    public function ingresos(Request $request): JsonResponse
    {
        $empresaId  = $request->integer('empresa_id');
        $desde      = $request->input('fecha_desde', now()->subDays(29)->toDateString());
        $hasta      = $request->input('fecha_hasta', now()->toDateString());
        $agrupacion = $request->input('agrupacion', 'dia'); // dia | semana | mes

        $trunc = match ($agrupacion) {
            'mes'    => 'month',
            'semana' => 'week',
            default  => 'day',
        };

        $filas = DB::table('ventas')
            ->selectRaw("DATE_TRUNC('{$trunc}', fecha_venta::date) as periodo, SUM(total) as total, COUNT(*) as cantidad")
            ->where('empresa_id', $empresaId)
            ->where('estado', 'completada')
            ->whereDate('fecha_venta', '>=', $desde)
            ->whereDate('fecha_venta', '<=', $hasta)
            ->groupByRaw("DATE_TRUNC('{$trunc}', fecha_venta::date)")
            ->orderBy('periodo')
            ->get()
            ->map(fn ($r) => [
                'periodo'  => substr($r->periodo, 0, 10),
                'total'    => (float) $r->total,
                'cantidad' => (int) $r->cantidad,
            ]);

        $resumen = DB::table('ventas')
            ->where('empresa_id', $empresaId)
            ->where('estado', 'completada')
            ->whereDate('fecha_venta', '>=', $desde)
            ->whereDate('fecha_venta', '<=', $hasta)
            ->selectRaw('COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad')
            ->first();

        return response()->json([
            'success' => true,
            'data'    => [
                'filas'   => $filas,
                'resumen' => [
                    'total'    => (float) $resumen->total,
                    'cantidad' => (int) $resumen->cantidad,
                    'promedio' => $resumen->cantidad > 0
                        ? round((float) $resumen->total / $resumen->cantidad, 2)
                        : 0,
                ],
            ],
        ]);
    }

    public function topProductos(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');
        $desde     = $request->input('fecha_desde', now()->subDays(29)->toDateString());
        $hasta     = $request->input('fecha_hasta', now()->toDateString());
        $limit     = min($request->integer('limit', 10), 50);

        $productos = DB::table('detalle_ventas as dv')
            ->join('ventas as v', 'dv.venta_id', '=', 'v.id')
            ->join('productos as p', 'dv.producto_id', '=', 'p.id')
            ->selectRaw('p.id, p.nombre, p.codigo, SUM(dv.cantidad) as total_unidades, SUM(dv.subtotal) as total_monto')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'completada')
            ->whereDate('v.fecha_venta', '>=', $desde)
            ->whereDate('v.fecha_venta', '<=', $hasta)
            ->groupBy('p.id', 'p.nombre', 'p.codigo')
            ->orderByDesc('total_monto')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'producto_id'    => $r->id,
                'nombre'         => $r->nombre,
                'codigo'         => $r->codigo,
                'total_unidades' => (float) $r->total_unidades,
                'total_monto'    => (float) $r->total_monto,
            ]);

        return response()->json([
            'success' => true,
            'data'    => $productos,
        ]);
    }
}
