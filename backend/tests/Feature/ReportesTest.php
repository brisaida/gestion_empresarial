<?php

namespace Tests\Feature;

use App\Models\Existencia;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReportesTest extends TestCase
{
    use RefreshDatabase;

    public function test_margen_sin_isv_y_productos_netos_de_devoluciones(): void
    {
        $empresaId = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA']);
        $bodegaId  = DB::table('bodegas')->insertGetId(['empresa_id' => $empresaId, 'nombre' => 'Tienda']);
        $u = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $u->forceFill(['es_super_admin' => true])->save();
        $this->actingAs($u);
        $p = Producto::create(['empresa_id' => $empresaId, 'nombre' => 'Panel', 'costo' => 60, 'precio_venta' => 100, 'activo' => true]);
        Existencia::create(['empresa_id' => $empresaId, 'bodega_id' => $bodegaId, 'producto_id' => $p->id, 'cantidad' => 100, 'cantidad_reservada' => 0]);

        // 10 × 100 = 1000 + ISV 150 + envío 50 = 1200; costo 600
        $venta = $this->postJson('/api/ventas', [
            'empresa_id' => $empresaId, 'bodega_id' => $bodegaId, 'fecha_venta' => today()->toDateString(),
            'impuesto' => 150, 'costo_envio' => 50, 'metodo_pago' => 'efectivo',
            'detalles' => [['producto_id' => $p->id, 'cantidad' => 10, 'precio_unitario' => 100]],
        ])->assertCreated()->json('data');

        $r = $this->getJson("/api/dashboard?empresa_id={$empresaId}")->json('data.resumen');
        $this->assertEquals(1200, $r['ventas_mes']);
        $this->assertEquals(400, $r['margen_bruto_mes']);       // 1000 − 600, sin ISV ni envío
        $this->assertEquals(40, $r['margen_pct']);

        // Devuelven 2: base 200, ISV 30, costo 120
        $linea = $this->getJson("/api/ventas/{$venta['id']}")->json('data.detalles.0.id');
        $this->postJson("/api/ventas/{$venta['id']}/devoluciones", [
            'motivo' => 'Defectuoso', 'reembolso_metodo' => 'efectivo', 'lineas' => [['detalle_id' => $linea, 'cantidad' => 2]],
        ])->assertCreated();

        $r = $this->getJson("/api/dashboard?empresa_id={$empresaId}")->json('data.resumen');
        $this->assertEquals(970, $r['ventas_mes']);               // 1200 − 230
        $this->assertEquals(320, $r['margen_bruto_mes']);         // 800 − 480

        $top = $this->getJson("/api/reportes/top-productos?empresa_id={$empresaId}")->json('data.0');
        $this->assertEquals(8, $top['total_unidades']);
        $this->assertEquals(800, $top['total_monto']);
        $this->assertEquals(8, $this->getJson("/api/dashboard?empresa_id={$empresaId}")->json('data.top_productos.0.total_vendido'));
    }
}
