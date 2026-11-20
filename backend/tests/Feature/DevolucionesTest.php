<?php

namespace Tests\Feature;

use App\Models\Existencia;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DevolucionesTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaId;
    private int $clienteId;
    private int $proveedorId;
    private Producto $a;
    private Producto $b;
    private User $usuario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->empresaId   = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA', 'dias_credito' => 30]);
        $this->bodegaId    = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->clienteId   = DB::table('clientes')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Cliente', 'activo' => true]);
        $this->proveedorId = DB::table('proveedores')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'LED STORE', 'activo' => true]);
        $this->usuario     = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $this->usuario->forceFill(['es_super_admin' => true])->save();
        $this->a = Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Panel', 'costo' => 50, 'precio_venta' => 100, 'activo' => true]);
        $this->b = Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Bombillo', 'costo' => 20, 'precio_venta' => 40, 'activo' => true]);
        foreach ([$this->a, $this->b] as $p) {
            Existencia::create(['empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'producto_id' => $p->id, 'cantidad' => 100, 'cantidad_reservada' => 0]);
        }
        $this->actingAs($this->usuario);
    }

    private function stock(Producto $p): float
    {
        return (float) Existencia::where('producto_id', $p->id)->value('cantidad');
    }

    private function vender(array $extra = []): array
    {
        return $this->postJson('/api/ventas', $extra + [
            'empresa_id' => $this->empresaId, 'cliente_id' => $this->clienteId, 'bodega_id' => $this->bodegaId,
            'fecha_venta' => '2026-11-20', 'descuento' => 100, 'impuesto' => 150,
            'detalles' => [
                ['producto_id' => $this->a->id, 'cantidad' => 10, 'precio_unitario' => 100],   // 1000
                ['producto_id' => $this->b->id, 'cantidad' => 5,  'precio_unitario' => 0],     // regalo
            ],
        ])->assertCreated()->json('data');
    }

    private function lineaId(array $venta, Producto $p): int
    {
        return $this->getJson("/api/ventas/{$venta['id']}")->collect('data.detalles')->firstWhere('producto_id', $p->id)['id'];
    }

    public function test_devolucion_parcial_de_contado_regresa_stock_y_reembolsa_en_proporcion(): void
    {
        $venta = $this->vender(['condicion' => 'contado', 'metodo_pago' => 'efectivo']);   // total 1000 - 100 + 150 = 1050
        $linea = $this->lineaId($venta, $this->a);
        $this->assertEquals(90, $this->stock($this->a));

        // Sin método de reembolso no se puede
        $this->postJson("/api/ventas/{$venta['id']}/devoluciones", ['motivo' => 'Defectuoso', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 2]]])
            ->assertStatus(422);

        $dev = $this->postJson("/api/ventas/{$venta['id']}/devoluciones", [
            'motivo' => 'Defectuoso', 'reembolso_metodo' => 'efectivo',
            'lineas' => [['detalle_id' => $linea, 'cantidad' => 2]],
        ])->assertCreated()->json('data');

        // 2 de 10 = 20%: subtotal 200 - 20 desc = 180, ISV 30, total 210
        $this->assertSame('DEV-000001', $dev['numero']);
        $this->assertEquals(180, $dev['subtotal']);
        $this->assertEquals(30, $dev['impuesto']);
        $this->assertEquals(210, $dev['total']);
        $this->assertEquals(210, $dev['reembolsado']);
        $this->assertEquals(92, $this->stock($this->a));

        // No se puede devolver más de lo vendido
        $this->postJson("/api/ventas/{$venta['id']}/devoluciones", ['motivo' => 'x', 'reembolso_metodo' => 'efectivo', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 9]]])
            ->assertStatus(422);

        $this->getJson("/api/ventas/{$venta['id']}")
            ->assertJsonPath('data.monto_devuelto', 210)
            ->assertJsonPath('data.detalles.0.cantidad_devuelta', 2);

        // Con devoluciones ya no se cancela completa (evita devolver dos veces el stock)
        $this->postJson("/api/ventas/{$venta['id']}/cancelar", ['motivo' => 'x'])->assertStatus(422);
    }

    public function test_devolucion_de_credito_baja_el_saldo_y_reembolsa_solo_lo_ya_pagado(): void
    {
        $venta = $this->vender(['condicion' => 'credito']);   // saldo 1050
        $linea = $this->lineaId($venta, $this->a);
        $this->postJson("/api/ventas/{$venta['id']}/abonos", ['monto' => 1000, 'metodo_pago' => 'efectivo'])->assertCreated(); // saldo 50

        $dev = $this->postJson("/api/ventas/{$venta['id']}/devoluciones", [
            'motivo' => 'No le sirvió', 'reembolso_metodo' => 'transferencia',
            'lineas' => [['detalle_id' => $linea, 'cantidad' => 2]],
        ])->assertCreated()->json('data');

        $this->assertEquals(50, $dev['aplicado_a_saldo']);   // se come el saldo
        $this->assertEquals(160, $dev['reembolsado']);       // y se le devuelve el resto
        $this->getJson("/api/ventas/{$venta['id']}")
            ->assertJsonPath('data.saldo_pendiente', 0)
            ->assertJsonPath('data.total_abonado', 1000)
            ->assertJsonPath('data.estado_pago', 'pagada');
    }

    public function test_devolucion_a_proveedor_saca_stock_y_baja_lo_que_se_debe(): void
    {
        $compra = $this->postJson('/api/compras', [
            'empresa_id' => $this->empresaId, 'proveedor_id' => $this->proveedorId, 'bodega_id' => $this->bodegaId,
            'numero_factura' => 'F-1', 'fecha_compra' => '2026-11-20', 'condicion' => 'credito', 'costo_envio' => 50,
            'detalles' => [['producto_id' => $this->a->id, 'cantidad' => 10, 'costo_unitario' => 50]],
        ])->assertCreated()->json('data');

        // Solo compras recibidas
        $linea = $this->getJson("/api/compras/{$compra['id']}")->json('data.detalles.0.id');
        $this->postJson("/api/compras/{$compra['id']}/devoluciones", ['motivo' => 'Dañado', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 1]]])
            ->assertStatus(422);

        $this->postJson("/api/compras/{$compra['id']}/recibir")->assertOk();
        $this->assertEquals(110, $this->stock($this->a));

        $dev = $this->postJson("/api/compras/{$compra['id']}/devoluciones", [
            'motivo' => 'Llegaron quebrados', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 3]],
        ])->assertCreated()->json('data');

        $this->assertSame('DPV-000001', $dev['numero']);
        $this->assertEquals(150, $dev['total']);
        $this->assertEquals(150, $dev['aplicado_a_saldo']);
        $this->assertEquals(107, $this->stock($this->a));
        $this->assertEquals(400, (float) DB::table('compras')->where('id', $compra['id'])->value('saldo_pendiente')); // 550 - 150

        // No se puede devolver más stock del que hay
        Existencia::where('producto_id', $this->a->id)->update(['cantidad' => 2]);
        $this->postJson("/api/compras/{$compra['id']}/devoluciones", ['motivo' => 'x', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 5]]])
            ->assertStatus(422);
    }

    public function test_reembolsos_en_efectivo_afectan_la_caja_y_cancelar_guarda_el_motivo(): void
    {
        $this->postJson('/api/caja', ['empresa_id' => $this->empresaId, 'monto_inicial' => 1000])->assertCreated();
        $venta = $this->vender(['condicion' => 'contado', 'metodo_pago' => 'efectivo']);   // +1050
        $this->postJson("/api/ventas/{$venta['id']}/devoluciones", [
            'motivo' => 'Cambio de opinión', 'reembolso_metodo' => 'efectivo', 'desde_caja' => true,
            'lineas' => [['detalle_id' => $this->lineaId($venta, $this->a), 'cantidad' => 2]],
        ])->assertCreated();                                                               // -210

        $resumen = $this->getJson("/api/caja/actual?empresa_id={$this->empresaId}")->json('data.resumen');
        $this->assertEquals(210, $resumen['reembolsos']['clientes']);
        $this->assertEquals(1840, $resumen['efectivo_esperado']);

        $otra = $this->vender(['condicion' => 'contado', 'metodo_pago' => 'tarjeta']);
        $this->postJson("/api/ventas/{$otra['id']}/cancelar")->assertStatus(422);         // sin motivo
        $this->postJson("/api/ventas/{$otra['id']}/cancelar", ['motivo' => 'Cliente se arrepintió'])->assertOk();
        $this->getJson("/api/ventas/{$otra['id']}")
            ->assertJsonPath('data.motivo_cancelacion', 'Cliente se arrepintió')
            ->assertJsonPath('data.cancelada_por', 'Admin');
    }
}
