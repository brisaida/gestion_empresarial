<?php

namespace Tests\Feature;

use App\Models\Existencia;
use App\Models\Producto;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BancosTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaId;
    private int $proveedorId;
    private Producto $producto;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->empresaId   = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA']);
        $this->bodegaId    = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->proveedorId = DB::table('proveedores')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'LED STORE', 'activo' => true]);
        $this->admin = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $this->admin->forceFill(['es_super_admin' => true])->save();
        $this->actingAs($this->admin);
        $this->producto = Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Panel', 'costo' => 50, 'precio_venta' => 100, 'activo' => true]);
        Existencia::create(['empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'producto_id' => $this->producto->id, 'cantidad' => 100, 'cantidad_reservada' => 0]);
    }

    private function cuenta(array $extra = []): int
    {
        return $this->postJson('/api/cuentas-bancarias', $extra + [
            'empresa_id' => $this->empresaId, 'banco' => 'BAC', 'nombre' => 'Operativa', 'tipo' => 'corriente',
            'ultimos4' => '1234', 'moneda' => 'HNL', 'saldo_inicial' => 1000, 'activo' => true,
        ])->assertCreated()->json('data.id');
    }

    private function saldo(int $id): float
    {
        return collect($this->getJson("/api/cuentas-bancarias?empresa_id={$this->empresaId}")->json('data.cuentas'))->firstWhere('id', $id)['saldo'];
    }

    private function vender(array $extra): array
    {
        return $this->postJson('/api/ventas', $extra + [
            'empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'fecha_venta' => today()->toDateString(),
            'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 10, 'precio_unitario' => 100]],
        ])->assertCreated()->json('data');
    }

    public function test_ventas_por_banco_usan_la_cuenta_por_defecto_y_cobran_comision_pos(): void
    {
        $c = $this->cuenta(['comision_pos_pct' => 3]);
        $this->vender(['metodo_pago' => 'tarjeta']);                                   // sin cuenta por defecto: no pasa nada
        $this->assertEquals(1000, $this->saldo($c));

        $this->putJson('/api/bancos/configuracion', ['empresa_id' => $this->empresaId, 'cuenta_tarjeta_id' => $c, 'cuenta_transferencia_id' => $c])->assertOk();
        $v = $this->vender(['metodo_pago' => 'tarjeta']);                              // +1000 −30 comisión
        $this->assertEquals(1970, $this->saldo($c));
        $this->vender(['metodo_pago' => 'efectivo']);                                  // el efectivo no va al banco
        $this->assertEquals(1970, $this->saldo($c));

        $this->postJson("/api/ventas/{$v['id']}/cancelar", ['motivo' => 'Error'])->assertOk();
        $this->assertEquals(1000, $this->saldo($c));                                     // anula venta y comisión
    }

    public function test_compras_pagos_y_pago_de_tarjeta_salen_del_banco(): void
    {
        $c = $this->cuenta();
        $compra = $this->postJson('/api/compras', [
            'empresa_id' => $this->empresaId, 'proveedor_id' => $this->proveedorId, 'bodega_id' => $this->bodegaId,
            'numero_factura' => 'F1', 'fecha_compra' => today()->toDateString(), 'metodo_pago' => 'transferencia', 'cuenta_bancaria_id' => $c,
            'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 2, 'costo_unitario' => 100]],
        ])->assertCreated()->json('data');
        $this->assertEquals(800, $this->saldo($c));

        // Cambiar a efectivo devuelve el dinero a la cuenta
        $this->patchJson("/api/compras/{$compra['id']}/condicion", ['condicion' => 'contado', 'metodo_pago' => 'efectivo'])->assertOk();
        $this->assertEquals(1000, $this->saldo($c));

        $t = $this->postJson('/api/tarjetas-credito', ['empresa_id' => $this->empresaId, 'nombre' => 'Visa', 'banco' => 'BAC', 'ultimos4' => '9999', 'activo' => true])->json('data.id');
        $this->postJson("/api/tarjetas-credito/{$t}/pagos", ['monto' => 300, 'metodo_pago' => 'transferencia', 'cuenta_bancaria_id' => $c])->assertCreated();
        $this->assertEquals(700, $this->saldo($c));
    }

    public function test_deposito_de_caja_transferencia_en_dolares_manual_y_conciliacion(): void
    {
        $hnl = $this->cuenta();
        $usd = $this->cuenta(['nombre' => 'Dólares', 'ultimos4' => '5555', 'moneda' => 'USD', 'saldo_inicial' => 0]);

        // Una cuenta en dólares no se puede usar en documentos (son en lempiras)
        $this->postJson('/api/ventas', [
            'empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'fecha_venta' => today()->toDateString(),
            'metodo_pago' => 'transferencia', 'cuenta_bancaria_id' => $usd,
            'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 1, 'precio_unitario' => 100]],
        ])->assertStatus(422);

        // Depósito de caja: suma al banco y resta del efectivo esperado
        $this->postJson('/api/caja', ['empresa_id' => $this->empresaId, 'monto_inicial' => 2000])->assertCreated();
        $this->postJson("/api/cuentas-bancarias/{$hnl}/deposito-caja", ['monto' => 500])->assertOk();
        $this->assertEquals(1500, $this->saldo($hnl));
        $this->assertEquals(1500, $this->getJson("/api/caja/actual?empresa_id={$this->empresaId}")->json('data.resumen.efectivo_esperado'));
        $this->postJson("/api/cuentas-bancarias/{$usd}/deposito-caja", ['monto' => 10])->assertStatus(422);

        // Transferencia HNL → USD: hay que decir cuánto llegó
        $this->postJson('/api/bancos/transferencias', ['cuenta_origen_id' => $hnl, 'cuenta_destino_id' => $usd, 'monto' => 1000])->assertStatus(422);
        $this->postJson('/api/bancos/transferencias', ['cuenta_origen_id' => $hnl, 'cuenta_destino_id' => $usd, 'monto' => 1000, 'monto_destino' => 40])->assertOk();
        $this->assertEquals(500, $this->saldo($hnl));
        $this->assertEquals(40, $this->saldo($usd));

        // Movimiento manual con categoría
        $cat = collect($this->getJson("/api/bancos/configuracion?empresa_id={$this->empresaId}")->json('data.categorias'))->firstWhere('nombre', 'Planilla')['id'];
        $this->postJson("/api/cuentas-bancarias/{$hnl}/movimientos", ['tipo' => 'salida', 'monto' => 200, 'descripcion' => 'Planilla quincena', 'categoria_banco_id' => $cat])->assertOk();
        $this->assertEquals(300, $this->saldo($hnl));

        // Conciliación y anulación (la transferencia se anula en las dos cuentas)
        $movs = $this->getJson("/api/cuentas-bancarias/{$hnl}/movimientos")->json('data');
        $this->assertEquals(3, $movs['sin_conciliar']['cantidad']);
        $planilla = collect($movs['movimientos'])->firstWhere('origen', 'manual')['id'];
        $this->postJson("/api/movimientos-banco/{$planilla}/conciliar", ['conciliado' => true])->assertOk();
        $this->assertEquals(2, $this->getJson("/api/cuentas-bancarias/{$hnl}/movimientos")->json('data.sin_conciliar.cantidad'));

        $transf = collect($movs['movimientos'])->firstWhere('origen', 'transferencia')['id'];
        $this->postJson("/api/movimientos-banco/{$transf}/anular")->assertOk();
        $this->assertEquals(1300, $this->saldo($hnl));
        $this->assertEquals(0, $this->saldo($usd));
    }

    public function test_permiso_finanzas(): void
    {
        $rol = Rol::create(['nombre' => 'Cajero', 'modulos' => ['ventas']]);
        $cajero = User::create(['nombre' => 'Cajero', 'correo' => 'c@c.com', 'password' => 'x']);
        DB::table('usuarios_empresas')->insert(['usuario_id' => $cajero->id, 'empresa_id' => $this->empresaId, 'rol_id' => $rol->id, 'activo' => true]);
        $v = $this->vender(['condicion' => 'credito', 'cliente_id' => DB::table('clientes')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'X', 'activo' => true])]);

        $this->actingAs($cajero);
        $this->getJson("/api/cuentas-por-cobrar?empresa_id={$this->empresaId}")->assertForbidden();
        $this->getJson("/api/cuentas-bancarias?empresa_id={$this->empresaId}")->assertForbidden();
        $this->getJson("/api/opciones/cuentas-bancarias?empresa_id={$this->empresaId}")->assertOk();      // selector sí
        $this->postJson("/api/ventas/{$v['id']}/abonos", ['monto' => 100, 'metodo_pago' => 'efectivo'])->assertCreated(); // cobrar sí

        $rol->update(['modulos' => ['ventas', 'finanzas']]);
        $this->getJson("/api/cuentas-por-cobrar?empresa_id={$this->empresaId}")->assertOk();
    }
}
