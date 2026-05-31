<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BodegaController;
use App\Http\Controllers\Api\SuperAdmin\DashboardAdminController;
use App\Http\Controllers\Api\SuperAdmin\EmpresaAdminController;
use App\Http\Controllers\Api\SuperAdmin\RolAdminController;
use App\Http\Controllers\Api\SuperAdmin\UsuarioAdminController;
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
use App\Http\Controllers\Api\EmpresaController;
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

    // Empresa (configuración)
    Route::get('empresa',             [EmpresaController::class, 'show']);
    Route::put('empresa',             [EmpresaController::class, 'update']);
    Route::get('empresa/logo-base64', [EmpresaController::class, 'logoBase64']);
    Route::post('empresa/logo',       [EmpresaController::class, 'uploadLogo']);
    Route::delete('empresa/logo',     [EmpresaController::class, 'deleteLogo']);

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
    // Nota: ->parameters(['cotizaciones' => 'cotizacion']) corrige la singularización
    // incorrecta de Laravel para palabras en español (cotizaciones → cotizacione → WRONG)
    Route::get('cotizaciones/siguiente-numero',           [CotizacionController::class, 'siguienteNumero']);
    Route::apiResource('cotizaciones', CotizacionController::class)
        ->only(['index', 'store', 'show', 'update'])
        ->parameters(['cotizaciones' => 'cotizacion']);
    Route::post('cotizaciones/{cotizacion}/estado',       [CotizacionController::class, 'cambiarEstado']);
    Route::post('cotizaciones/{cotizacion}/convertir',    [CotizacionController::class, 'convertirAVenta']);

    // Ventas
    Route::get('ventas/siguiente-numero',  [VentaController::class, 'siguienteNumero']);
    Route::apiResource('ventas', VentaController::class)->only(['index', 'store', 'show']);
    Route::post('ventas/{venta}/cancelar', [VentaController::class, 'cancelar']);

    // Transferencias
    Route::apiResource('transferencias', TransferenciaController::class)->only(['index', 'store', 'show']);
});

// ── Super Admin ────────────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'super.admin'])->prefix('sa')->group(function () {

    // Dashboard
    Route::get('dashboard', [DashboardAdminController::class, 'index']);

    // Empresas
    Route::get('empresas',                    [EmpresaAdminController::class, 'index']);
    Route::post('empresas',                   [EmpresaAdminController::class, 'store']);
    Route::put('empresas/{empresa}',          [EmpresaAdminController::class, 'update']);
    Route::patch('empresas/{empresa}/toggle', [EmpresaAdminController::class, 'toggle']);

    // Usuarios
    Route::get('usuarios',                                      [UsuarioAdminController::class, 'index']);
    Route::post('usuarios',                                     [UsuarioAdminController::class, 'store']);
    Route::put('usuarios/{usuario}',                            [UsuarioAdminController::class, 'update']);
    Route::patch('usuarios/{usuario}/toggle',                   [UsuarioAdminController::class, 'toggle']);
    Route::get('usuarios/{usuario}/empresas',                   [UsuarioAdminController::class, 'empresas']);
    Route::post('usuarios/{usuario}/empresas',                  [UsuarioAdminController::class, 'asignarEmpresa']);
    Route::delete('usuarios/{usuario}/empresas/{empresa}',      [UsuarioAdminController::class, 'quitarEmpresa']);

    // Roles
    Route::get('roles',             [RolAdminController::class, 'index']);
    Route::post('roles',            [RolAdminController::class, 'store']);
    Route::put('roles/{rol}',       [RolAdminController::class, 'update']);
    Route::delete('roles/{rol}',    [RolAdminController::class, 'destroy']);
});
