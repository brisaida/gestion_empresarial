<?php

namespace App\Http\Controllers\Api;

use App\Models\Compra;
use App\Models\Existencia;
use App\Models\Producto;
use App\Models\Venta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->integer('empresa_id');

        $totalProductos  = Producto::where('empresa_id', $empresaId)->where('activo', true)->count();
        $totalProveedores = \App\Models\Proveedor::where('empresa_id', $empresaId)->where('activo', true)->count();

        // Stock bajo: productos cuyo stock total <= stock_minimo
        $productosStockBajo = Existencia::query()
            ->selectRaw('producto_id, SUM(cantidad) as total')
            ->where('empresa_id', $empresaId)
            ->groupBy('producto_id')
            ->havingRaw('SUM(cantidad) <= (SELECT stock_minimo FROM productos WHERE id = existencias.producto_id AND stock_minimo > 0)')
            ->count();

        // Totales del mes actual
        $inicioMes = now()->startOfMonth()->toDateString();
        $finMes    = now()->endOfMonth()->toDateString();

        $comprasMes = Compra::where('empresa_id', $empresaId)
            ->whereIn('estado', ['recibida'])
            ->whereBetween('fecha_compra', [$inicioMes, $finMes])
            ->sum('total');

        $ventasMes = Venta::where('empresa_id', $empresaId)
            ->where('estado', 'completada')
            ->whereBetween('fecha_venta', [$inicioMes, $finMes])
            ->sum('total');

        // Ventas mes anterior (para variación %)
        $inicioMesAnt = now()->subMonth()->startOfMonth()->toDateString();
        $finMesAnt    = now()->subMonth()->endOfMonth()->toDateString();

        $ventasMesAnterior = Venta::where('empresa_id', $empresaId)
            ->where('estado', 'completada')
            ->whereBetween('fecha_venta', [$inicioMesAnt, $finMesAnt])
            ->sum('total');

        $variacionVentas = $ventasMesAnterior > 0
            ? round((((float) $ventasMes - (float) $ventasMesAnterior) / (float) $ventasMesAnterior) * 100, 1)
            : null;

        // Margen bruto del mes (ventas - costo de lo vendido)
        $costoVentasMes = DB::table('detalle_ventas as dv')
            ->join('ventas as v', 'dv.venta_id', '=', 'v.id')
            ->where('v.empresa_id', $empresaId)
            ->where('v.estado', 'completada')
            ->whereBetween('v.fecha_venta', [$inicioMes, $finMes])
            ->sum(DB::raw('dv.cantidad * dv.costo_unitario'));

        $margenBruto = (float) $ventasMes - (float) $costoVentasMes;
        $margenPct   = (float) $ventasMes > 0
            ? round($margenBruto / (float) $ventasMes * 100, 1)
            : 0;

        // Valor del inventario actual (stock × costo)
        $valorInventario = DB::table('existencias as e')
            ->join('productos as p', 'e.producto_id', '=', 'p.id')
            ->where('p.empresa_id', $empresaId)
            ->sum(DB::raw('e.cantidad * p.costo'));

        // Compras pendientes
        $comprasPendientes = Compra::where('empresa_id', $empresaId)
            ->where('estado', 'pendiente')
            ->selectRaw('COUNT(*) as cantidad, COALESCE(SUM(total), 0) as monto')
            ->first();

        // Últimas 5 ventas
        $ultimasVentas = Venta::with('cliente')
            ->where('empresa_id', $empresaId)
            ->where('estado', 'completada')
            ->orderByDesc('fecha_venta')
            ->limit(5)
            ->get()
            ->map(fn($v) => [
                'id'          => $v->id,
                'cliente'     => $v->cliente?->nombre ?? 'Consumidor final',
                'total'       => (float) $v->total,
                'fecha_venta' => $v->fecha_venta?->toDateString(),
            ]);

        // Productos con más movimiento (top 5 por cantidad vendida)
        $topProductos = DB::table('detalle_ventas')
            ->join('ventas', 'ventas.id', '=', 'detalle_ventas.venta_id')
            ->join('productos', 'productos.id', '=', 'detalle_ventas.producto_id')
            ->where('ventas.empresa_id', $empresaId)
            ->where('ventas.estado', 'completada')
            ->whereBetween('ventas.fecha_venta', [$inicioMes, $finMes])
            ->selectRaw('detalle_ventas.producto_id, productos.nombre, SUM(detalle_ventas.cantidad) as total_vendido')
            ->groupBy('detalle_ventas.producto_id', 'productos.nombre')
            ->orderByDesc('total_vendido')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'resumen' => [
                    'total_productos'           => $totalProductos,
                    'total_proveedores'         => $totalProveedores,
                    'productos_stock_bajo'      => $productosStockBajo,
                    'compras_mes'               => (float) $comprasMes,
                    'ventas_mes'                => (float) $ventasMes,
                    'ventas_mes_anterior'       => (float) $ventasMesAnterior,
                    'variacion_ventas_pct'      => $variacionVentas,
                    'margen_bruto_mes'          => $margenBruto,
                    'margen_pct'                => $margenPct,
                    'valor_inventario'          => (float) $valorInventario,
                    'compras_pendientes_count'  => (int) $comprasPendientes->cantidad,
                    'compras_pendientes_monto'  => (float) $comprasPendientes->monto,
                ],
                'ultimas_ventas' => $ultimasVentas,
                'top_productos'  => $topProductos,
            ],
        ]);
    }
}
