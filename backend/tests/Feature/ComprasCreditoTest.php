<?php

namespace Tests\Feature;

use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ComprasCreditoTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaId;
    private int $proveedorId;
    private Producto $producto;
    private User $usuario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->empresaId   = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA', 'dias_credito' => 30]);
        $this->bodegaId    = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->proveedorId = DB::table('proveedores')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'LED STORE', 'activo' => true]);
        $this->usuario     = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $this->usuario->forceFill(['es_super_admin' => true])->save();
        $this->producto = Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Panel', 'costo' => 50, 'precio_venta' => 100, 'activo' => true]);
    }

    private function comprar(array $extra = [], float $costo = 100)
    {
        static $n = 0; $n++;
        return $this->actingAs($this->usuario)->postJson('/api/compras', $extra + [
            'empresa_id'     => $this->empresaId,
            'proveedor_id'   => $this->proveedorId,
            'bodega_id'      => $this->bodegaId,
            'numero_factura' => "F-{$n}",
            'fecha_compra'   => '2026-11-01',
            'detalles'       => [['producto_id' => $this->producto->id, 'cantidad' => 10, 'costo_unitario' => $costo]],
        ]);
    }

    public function test_contado_guarda_el_metodo_y_credito_el_vencimiento(): void
    {
        $this->comprar(['condicion' => 'contado', 'metodo_pago' => 'debito'])
            ->assertCreated()->assertJsonPath('data.metodo_pago', 'debito')->assertJsonPath('data.saldo_pendiente', 0);

        DB::table('proveedores')->where('id', $this->proveedorId)->update(['dias_credito' => 15]);
        $this->comprar(['condicion' => 'credito'])
            ->assertCreated()
            ->assertJsonPath('data.condicion', 'credito')
            ->assertJsonPath('data.dias_credito', 15)
            ->assertJsonPath('data.fecha_vencimiento', '2026-11-16')
            ->assertJsonPath('data.saldo_pendiente', 1000);
    }

    public function test_pagos_parciales_general_y_anulacion(): void
    {
        $a = $this->comprar(['condicion' => 'credito', 'fecha_compra' => '2026-10-01'])->json('data.id');
        $b = $this->comprar(['condicion' => 'credito'])->json('data.id');

        $this->postJson("/api/compras/{$a}/pagos", ['monto' => 1500, 'metodo_pago' => 'transferencia'])->assertStatus(422);
        $pagoId = $this->postJson("/api/compras/{$a}/pagos", ['monto' => 400, 'metodo_pago' => 'transferencia'])->assertCreated()->json('data.id');
        $this->assertEquals(600, (float) DB::table('compras')->where('id', $a)->value('saldo_pendiente'));

        $this->postJson("/api/pagos-compra/{$pagoId}/anular")->assertOk();
        $this->assertEquals(1000, (float) DB::table('compras')->where('id', $a)->value('saldo_pendiente'));

        // Pago general: primero la que vence antes
        $this->postJson("/api/cuentas-por-pagar/proveedores/{$this->proveedorId}/pagos", ['monto' => 1200, 'metodo_pago' => 'cheque'])
            ->assertCreated()->assertJsonCount(2, 'data');
        $this->assertEquals(0, (float) DB::table('compras')->where('id', $a)->value('saldo_pendiente'));
        $this->assertEquals(800, (float) DB::table('compras')->where('id', $b)->value('saldo_pendiente'));

        $this->getJson("/api/cuentas-por-pagar?empresa_id={$this->empresaId}")
            ->assertOk()->assertJsonPath('data.totales.saldo', 800)->assertJsonPath('data.totales.facturas', 1);
    }

    public function test_cambiar_condicion_de_una_compra_existente(): void
    {
        $id = $this->comprar()->json('data.id');   // sin condición = contado
        $this->patchJson("/api/compras/{$id}/condicion", ['condicion' => 'credito'])
            ->assertOk()->assertJsonPath('data.saldo_pendiente', 1000)->assertJsonPath('data.fecha_vencimiento', '2026-12-01');

        $this->postJson("/api/compras/{$id}/pagos", ['monto' => 100, 'metodo_pago' => 'efectivo'])->assertCreated();
        $this->patchJson("/api/compras/{$id}/condicion", ['condicion' => 'contado', 'metodo_pago' => 'debito'])->assertStatus(422);
    }

    public function test_pago_en_efectivo_desde_caja_resta_del_efectivo_esperado(): void
    {
        $this->actingAs($this->usuario)->postJson('/api/caja', ['empresa_id' => $this->empresaId, 'monto_inicial' => 2000])->assertCreated();
        $id = $this->comprar(['condicion' => 'credito'])->json('data.id');

        $this->postJson("/api/compras/{$id}/pagos", ['monto' => 300, 'metodo_pago' => 'efectivo', 'desde_caja' => true])->assertCreated();
        $this->postJson("/api/compras/{$id}/pagos", ['monto' => 200, 'metodo_pago' => 'efectivo', 'desde_caja' => false])->assertCreated();
        $this->postJson("/api/compras/{$id}/pagos", ['monto' => 100, 'metodo_pago' => 'transferencia', 'desde_caja' => true])->assertCreated();

        $resumen = $this->getJson("/api/caja/actual?empresa_id={$this->empresaId}")->json('data.resumen');
        $this->assertEquals(300, $resumen['pagos_proveedores']['total']);
        $this->assertEquals(1700, $resumen['efectivo_esperado']);
    }

    public function test_el_envio_se_suma_al_total_y_al_saldo_de_la_compra(): void
    {
        $this->comprar(['condicion' => 'credito', 'costo_envio' => 150, 'impuesto' => 150])
            ->assertCreated()
            ->assertJsonPath('data.costo_envio', 150)
            ->assertJsonPath('data.total', 1300)
            ->assertJsonPath('data.saldo_pendiente', 1300);
    }
}
