<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BodegaController;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\CompraController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExistenciaController;
use App\Http\Controllers\Api\MarcaController;
use App\Http\Controllers\Api\MovimientoController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\ProveedorController;
use App\Http\Controllers\Api\TransferenciaController;
use App\Http\Controllers\Api\UnidadMedidaController;
use App\Http\Controllers\Api\CotizacionController;
use App\Http\Controllers\Api\VentaController;
use Illuminate\Support\Facades\Route;

// ── Autenticación (sin token) ──────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
});

// ── Rutas protegidas (requieren token Sanctum) ─────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('auth/me',       [AuthController::class, 'me']);
    Route::post('auth/logout',  [AuthController::class, 'logout']);

    // Dashboard
    Route::get('dashboard', [DashboardController::class, 'index']);

    // Catálogos
    Route::apiResource('categorias',     CategoriaController::class);
    Route::apiResource('marcas',         MarcaController::class);
    Route::apiResource('unidades-medida', UnidadMedidaController::class);
    Route::apiResource('proveedores',    ProveedorController::class);
    Route::apiResource('clientes',       ClienteController::class);
    Route::apiResource('bodegas',        BodegaController::class);

    // Productos
    Route::apiResource('productos', ProductoController::class);
    Route::post('productos/{producto}/imagen', [ProductoController::class, 'uploadImagen']);

    // Inventario — stock
    Route::get('existencias',                   [ExistenciaController::class, 'index']);
    Route::get('existencias/resumen-por-producto', [ExistenciaController::class, 'resumenPorProducto']);

    // Movimientos manuales (entradas/salidas/ajustes)
    Route::get('movimientos',       [MovimientoController::class, 'index']);
    Route::post('movimientos',      [MovimientoController::class, 'store']);
    Route::get('movimientos/{movimientoInventario}', [MovimientoController::class, 'show']);

    // Compras
    Route::apiResource('compras', CompraController::class)->only(['index', 'store', 'show']);
    Route::post('compras/{compra}/recibir',   [CompraController::class, 'recibir']);
    Route::post('compras/{compra}/cancelar',  [CompraController::class, 'cancelar']);

    // Cotizaciones
    Route::get('cotizaciones/siguiente-numero',           [CotizacionController::class, 'siguienteNumero']);
    Route::apiResource('cotizaciones', CotizacionController::class)->only(['index', 'store', 'show', 'update']);
    Route::post('cotizaciones/{cotizacion}/estado',       [CotizacionController::class, 'cambiarEstado']);
    Route::post('cotizaciones/{cotizacion}/convertir',    [CotizacionController::class, 'convertirAVenta']);

    // Ventas
    Route::get('ventas/siguiente-numero',  [VentaController::class, 'siguienteNumero']);
    Route::apiResource('ventas', VentaController::class)->only(['index', 'store', 'show']);
    Route::post('ventas/{venta}/cancelar', [VentaController::class, 'cancelar']);

    // Transferencias
    Route::apiResource('transferencias', TransferenciaController::class)->only(['index', 'store', 'show']);
});
