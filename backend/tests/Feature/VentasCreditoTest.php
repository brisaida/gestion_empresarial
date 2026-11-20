<?php

namespace Tests\Feature;

use App\Models\Existencia;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class VentasCreditoTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaId;
    private int $clienteId;
    private Producto $producto;
    private User $usuario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->empresaId = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA', 'dias_credito' => 15]);
        $this->bodegaId  = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->clienteId = DB::table('clientes')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Ferretería López', 'activo' => true]);
        $this->usuario   = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $this->usuario->forceFill(['es_super_admin' => true])->save();

        $this->producto = Producto::create([
            'empresa_id' => $this->empresaId, 'nombre' => 'Cable', 'costo' => 50, 'precio_venta' => 100, 'activo' => true,
        ]);
        Existencia::create([
            'empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'producto_id' => $this->producto->id,
            'cantidad' => 100, 'cantidad_reservada' => 0,
        ]);
    }

    private function vender(array $extra = [], int $cantidad = 10)
    {
        return $this->actingAs($this->usuario)->postJson('/api/ventas', $extra + [
            'empresa_id'  => $this->empresaId,
            'cliente_id'  => $this->clienteId,
            'bodega_id'   => $this->bodegaId,
            'fecha_venta' => '2026-11-01',
            'detalles'    => [['producto_id' => $this->producto->id, 'cantidad' => $cantidad, 'precio_unitario' => 100]],
        ]);
    }

    public function test_venta_al_credito_usa_los_dias_de_la_empresa_por_defecto(): void
    {
        $r = $this->vender(['condicion' => 'credito'])->assertCreated();

        $r->assertJsonPath('data.condicion', 'credito')
          ->assertJsonPath('data.dias_credito', 15)
          ->assertJsonPath('data.fecha_vencimiento', '2026-11-16')
          ->assertJsonPath('data.saldo_pendiente', 1000)
          ->assertJsonPath('data.metodo_pago', null);

        // El stock se rebaja igual que en contado
        $this->assertEquals(90, (float) Existencia::where('producto_id', $this->producto->id)->value('cantidad'));
    }

    public function test_los_dias_del_cliente_y_los_del_formulario_tienen_prioridad(): void
    {
        DB::table('clientes')->where('id', $this->clienteId)->update(['dias_credito' => 45]);
        $this->vender(['condicion' => 'credito'])->assertJsonPath('data.dias_credito', 45);
        $this->vender(['condicion' => 'credito', 'dias_credito' => 7])->assertJsonPath('data.fecha_vencimiento', '2026-11-08');
    }

    public function test_credito_requiere_cliente_y_respeta_el_limite(): void
    {
        $this->vender(['condicion' => 'credito', 'cliente_id' => null])->assertStatus(422);

        DB::table('clientes')->where('id', $this->clienteId)->update(['limite_credito' => 1500]);
        $this->vender(['condicion' => 'credito'])->assertCreated();                // debe 1000
        $this->vender(['condicion' => 'credito'], 6)->assertStatus(422)            // 1000 + 600 > 1500
             ->assertJsonFragment(['success' => false]);
        $this->vender(['condicion' => 'credito'], 5)->assertCreated();             // 1000 + 500 = 1500
        $this->vender(['condicion' => 'contado'], 5)->assertCreated();             // contado no cuenta
    }

    public function test_abonos_bajan_el_saldo_y_anular_lo_devuelve(): void
    {
        $ventaId = $this->vender(['condicion' => 'credito'])->json('data.id');

        $this->postJson("/api/ventas/{$ventaId}/abonos", ['monto' => 1200, 'metodo_pago' => 'efectivo'])->assertStatus(422);
        $abonoId = $this->postJson("/api/ventas/{$ventaId}/abonos", ['monto' => 400, 'metodo_pago' => 'efectivo'])
            ->assertCreated()->json('data.id');
        $this->assertEquals(600, (float) DB::table('ventas')->where('id', $ventaId)->value('saldo_pendiente'));

        // No se puede cancelar con abonos vigentes
        $this->postJson("/api/ventas/{$ventaId}/cancelar", ["motivo" => "Prueba"])->assertStatus(422);

        $this->postJson("/api/abonos/{$abonoId}/anular")->assertOk();
        $this->postJson("/api/abonos/{$abonoId}/anular")->assertStatus(422);
        $this->assertEquals(1000, (float) DB::table('ventas')->where('id', $ventaId)->value('saldo_pendiente'));

        $this->postJson("/api/ventas/{$ventaId}/abonos", ['monto' => 1000, 'metodo_pago' => 'transferencia'])->assertCreated();
        $this->getJson("/api/ventas/{$ventaId}")->assertJsonPath('data.estado_pago', 'pagada');
    }

    public function test_abono_general_se_reparte_de_la_factura_mas_antigua_a_la_mas_nueva(): void
    {
        $a = $this->vender(['condicion' => 'credito', 'fecha_venta' => '2026-10-01'])->json('data.id');
        $b = $this->vender(['condicion' => 'credito', 'fecha_venta' => '2026-11-01'])->json('data.id');

        $this->postJson("/api/cuentas-por-cobrar/clientes/{$this->clienteId}/abonos", ['monto' => 2500, 'metodo_pago' => 'efectivo'])
            ->assertStatus(422);
        $this->postJson("/api/cuentas-por-cobrar/clientes/{$this->clienteId}/abonos", ['monto' => 1300, 'metodo_pago' => 'efectivo'])
            ->assertCreated()->assertJsonCount(2, 'data');

        $this->assertEquals(0, (float) DB::table('ventas')->where('id', $a)->value('saldo_pendiente'));
        $this->assertEquals(700, (float) DB::table('ventas')->where('id', $b)->value('saldo_pendiente'));

        $r = $this->getJson("/api/cuentas-por-cobrar?empresa_id={$this->empresaId}")->assertOk();
        $r->assertJsonPath('data.totales.saldo', 700)->assertJsonPath('data.totales.facturas', 1);
    }

    public function test_la_caja_no_cuenta_credito_como_efectivo_pero_si_los_abonos(): void
    {
        $this->actingAs($this->usuario)->postJson('/api/caja', ['empresa_id' => $this->empresaId, 'monto_inicial' => 100])->assertCreated();

        $this->vender(['condicion' => 'contado', 'metodo_pago' => 'efectivo'], 2);   // 200 efectivo
        $ventaId = $this->vender(['condicion' => 'credito'], 10)->json('data.id');     // 1000 crédito
        $this->postJson("/api/ventas/{$ventaId}/abonos", ['monto' => 300, 'metodo_pago' => 'efectivo'])->assertCreated();
        $this->postJson("/api/ventas/{$ventaId}/abonos", ['monto' => 100, 'metodo_pago' => 'tarjeta'])->assertCreated();

        $resumen = $this->getJson("/api/caja/actual?empresa_id={$this->empresaId}")->json('data.resumen');

        $this->assertEquals(200, $resumen['total_ventas']);
        $this->assertEquals(1000, $resumen['credito']['total']);
        $this->assertEquals(400, $resumen['abonos']['total']);
        $this->assertEquals(600, $resumen['efectivo_esperado']); // 100 inicial + 200 venta + 300 abono
    }

    public function test_cancelar_una_venta_devuelve_el_stock_una_sola_vez(): void
    {
        $stock = fn() => (float) Existencia::where('producto_id', $this->producto->id)->value('cantidad');

        $ventaId = $this->vender(['condicion' => 'contado'], 19)->json('data.id');
        $this->assertEquals(81, $stock());

        $this->postJson("/api/ventas/{$ventaId}/cancelar", ["motivo" => "Prueba"])->assertOk();
        $this->assertEquals(100, $stock());

        // Cancelar otra vez no vuelve a sumar
        $this->postJson("/api/ventas/{$ventaId}/cancelar", ["motivo" => "Prueba"])->assertStatus(409);
        $this->assertEquals(100, $stock());

        // Se puede volver a vender lo devuelto
        $this->vender(['condicion' => 'contado'], 19)->assertCreated();
        $this->assertEquals(81, $stock());
    }

    public function test_el_comando_devuelve_stock_de_ventas_canceladas_antes_del_arreglo(): void
    {
        $stock = fn() => (float) Existencia::where('producto_id', $this->producto->id)->value('cantidad');
        $ventaId = $this->vender(['condicion' => 'contado'], 19)->json('data.id');
        DB::table('ventas')->where('id', $ventaId)->update(['estado' => 'cancelada']); // como quedaban antes
        $this->assertEquals(81, $stock());

        $this->artisan('ventas:devolver-stock', ['ventas' => [$ventaId]])->assertSuccessful();
        $this->assertEquals(81, $stock()); // sin --confirmar no cambia nada

        $this->artisan('ventas:devolver-stock', ['ventas' => [$ventaId], '--confirmar' => true])->assertSuccessful();
        $this->assertEquals(100, $stock());

        $this->artisan('ventas:devolver-stock', ['ventas' => [$ventaId], '--confirmar' => true])->assertSuccessful();
        $this->assertEquals(100, $stock());
    }
}
