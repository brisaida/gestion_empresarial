<?php

namespace Tests\Feature;

use App\Models\Existencia;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TarjetasCreditoTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaId;
    private int $proveedorId;
    private Producto $producto;

    protected function setUp(): void
    {
        parent::setUp();
        $this->empresaId   = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA']);
        $this->bodegaId    = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->proveedorId = DB::table('proveedores')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'LED STORE', 'activo' => true]);
        $u = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $u->forceFill(['es_super_admin' => true])->save();
        $this->actingAs($u);
        $this->producto = Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Panel', 'costo' => 50, 'precio_venta' => 100, 'activo' => true]);
    }

    private function tarjeta(array $extra = []): int
    {
        return $this->postJson('/api/tarjetas-credito', $extra + [
            'empresa_id' => $this->empresaId, 'nombre' => 'Visa Empresarial', 'banco' => 'BAC', 'ultimos4' => '4521',
            'dia_corte' => 15, 'dia_pago' => 5, 'limite' => 50000, 'activo' => true,
        ])->assertCreated()->json('data.id');
    }

    private function saldo(int $id): float
    {
        return collect($this->getJson("/api/tarjetas-credito?empresa_id={$this->empresaId}")->json('data'))->firstWhere('id', $id)['saldo'];
    }

    private function requisicion(array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/requisiciones', $extra + [
            'empresa_id' => $this->empresaId, 'proveedor_id' => $this->proveedorId, 'fecha_requisicion' => '2026-11-20',
            'condicion' => 'contado', 'impuesto' => 150,
            'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 10, 'precio_unitario' => 100]],
        ]);
    }

    private function compra(array $extra = []): array
    {
        static $n = 0; $n++;
        return $this->postJson('/api/compras', $extra + [
            'empresa_id' => $this->empresaId, 'proveedor_id' => $this->proveedorId, 'bodega_id' => $this->bodegaId,
            'numero_factura' => "F-{$n}", 'fecha_compra' => '2026-11-20',
            'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 10, 'costo_unitario' => 100]],
        ])->assertCreated()->json('data');
    }

    public function test_requisicion_con_tarjeta_carga_y_cancelarla_lo_anula(): void
    {
        $t = $this->tarjeta();
        $this->requisicion(['metodo_pago' => 'tarjeta'])->assertStatus(422);          // falta la tarjeta

        $req = $this->requisicion(['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t])
            ->assertCreated()->assertJsonPath('data.tarjeta.etiqueta', 'BAC Visa Empresarial ••4521')->json('data');
        $this->assertEquals(1150, $this->saldo($t));

        $this->postJson("/api/requisiciones/{$req['id']}/estado", ['estado' => 'cancelada'])->assertOk();
        $this->assertEquals(0, $this->saldo($t));
    }

    public function test_compra_de_una_requisicion_ya_cargada_no_carga_dos_veces(): void
    {
        $t   = $this->tarjeta();
        $req = $this->requisicion(['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t])->json('data');

        $pend = $this->getJson("/api/requisiciones-con-tarjeta?empresa_id={$this->empresaId}&proveedor_id={$this->proveedorId}")->json('data');
        $this->assertCount(1, $pend);

        $this->compra(['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t, 'requisicion_id' => $req['id']]);
        $this->assertEquals(1150, $this->saldo($t));                                     // sigue un solo cargo
        $this->assertCount(0, $this->getJson("/api/requisiciones-con-tarjeta?empresa_id={$this->empresaId}")->json('data'));

        // Una compra suelta con tarjeta sí carga
        $c = $this->compra(['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t]);
        $this->assertEquals(2150, $this->saldo($t));

        // Pasarla a débito quita el cargo
        $this->patchJson("/api/compras/{$c['id']}/condicion", ['condicion' => 'contado', 'metodo_pago' => 'debito'])->assertOk();
        $this->assertEquals(1150, $this->saldo($t));
    }

    public function test_pagos_al_banco_movimientos_y_cargos_manuales(): void
    {
        $t = $this->tarjeta();
        $this->compra(['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t]);          // 1000
        $this->postJson("/api/tarjetas-credito/{$t}/cargos", ['monto' => 250, 'descripcion' => 'Gasolina'])->assertCreated();
        $this->postJson("/api/tarjetas-credito/{$t}/pagos", ['monto' => 600, 'metodo_pago' => 'transferencia', 'referencia' => 'TX9'])->assertCreated();

        $this->assertEquals(650, $this->saldo($t));
        $movs = $this->getJson("/api/tarjetas-credito/{$t}/movimientos")->assertOk()->json('data.movimientos');
        $this->assertCount(3, $movs);
        $this->assertEquals(650, $movs[0]['saldo']);                                        // el más reciente primero

        $pagoId  = collect($movs)->firstWhere('tipo', 'pago')['id'];
        $cargoId = collect($movs)->firstWhere('origen', 'manual')['id'];
        $compraCargo = collect($movs)->firstWhere('origen', 'compra')['id'];
        $this->postJson("/api/pagos-tarjeta/{$pagoId}/anular")->assertOk();
        $this->postJson("/api/cargos-tarjeta/{$cargoId}/anular")->assertOk();
        $this->postJson("/api/cargos-tarjeta/{$compraCargo}/anular")->assertStatus(422);  // se corrige desde la compra
        $this->assertEquals(1000, $this->saldo($t));
    }

    public function test_pago_a_proveedor_con_tarjeta_y_devolucion_reembolsada_a_la_tarjeta(): void
    {
        $t = $this->tarjeta();
        $credito = $this->compra(['condicion' => 'credito']);
        $this->postJson("/api/compras/{$credito['id']}/pagos", ['monto' => 400, 'metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t])->assertCreated();
        $this->assertEquals(400, $this->saldo($t));

        $c = $this->compra(['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t]);       // +1000
        $this->postJson("/api/compras/{$c['id']}/recibir")->assertOk();
        $linea = $this->getJson("/api/compras/{$c['id']}")->json('data.detalles.0.id');
        $this->postJson("/api/compras/{$c['id']}/devoluciones", [
            'motivo' => 'Dañado', 'reembolso_metodo' => 'tarjeta', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 2]],
        ])->assertCreated();
        $this->assertEquals(1200, $this->saldo($t));                                          // 400 + 1000 - 200
    }

    public function test_pago_de_tarjeta_en_efectivo_de_caja_resta_del_efectivo_esperado(): void
    {
        $t = $this->tarjeta();
        $this->postJson('/api/caja', ['empresa_id' => $this->empresaId, 'monto_inicial' => 1000])->assertCreated();
        $this->postJson("/api/tarjetas-credito/{$t}/pagos", ['monto' => 300, 'metodo_pago' => 'efectivo', 'desde_caja' => true])->assertCreated();
        $r = $this->getJson("/api/caja/actual?empresa_id={$this->empresaId}")->json('data.resumen');
        $this->assertEquals(300, $r['pagos_tarjetas']);
        $this->assertEquals(700, $r['efectivo_esperado']);
    }

    public function test_forma_de_pago_se_puede_poner_despues_de_enviada(): void
    {
        $t   = $this->tarjeta();
        $req = $this->requisicion()->assertCreated()->json('data');
        $this->postJson("/api/requisiciones/{$req['id']}/estado", ['estado' => 'enviada'])->assertOk();

        $this->patchJson("/api/requisiciones/{$req['id']}/forma-pago", ['metodo_pago' => 'tarjeta'])->assertStatus(422);
        $this->patchJson("/api/requisiciones/{$req['id']}/forma-pago", ['metodo_pago' => 'tarjeta', 'tarjeta_credito_id' => $t])
            ->assertOk()->assertJsonPath('data.tarjeta.ultimos4', '4521');
        $this->assertEquals(1150, $this->saldo($t));

        $this->patchJson("/api/requisiciones/{$req['id']}/forma-pago", ['metodo_pago' => 'transferencia'])->assertOk();
        $this->assertEquals(0, $this->saldo($t));
    }
}
