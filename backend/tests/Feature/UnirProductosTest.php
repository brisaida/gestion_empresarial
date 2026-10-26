<?php

namespace Tests\Feature;

use App\Models\Existencia;
use App\Models\MovimientoInventario;
use App\Models\Producto;
use App\Services\InventarioService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UnirProductosTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaA;
    private int $bodegaB;
    private int $usuarioId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->empresaId = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA']);
        $this->bodegaA   = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->bodegaB   = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Bodega']);
        $this->usuarioId = DB::table('usuarios')->insertGetId(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
    }

    private function producto(array $datos): Producto
    {
        return Producto::create($datos + [
            'empresa_id' => $this->empresaId, 'nombre' => 'Interruptor', 'costo' => 0, 'precio_venta' => 0, 'activo' => true,
        ]);
    }

    private function stock(Producto $p, int $bodegaId, float $cantidad): void
    {
        Existencia::create([
            'empresa_id' => $this->empresaId, 'bodega_id' => $bodegaId, 'producto_id' => $p->id,
            'cantidad' => $cantidad, 'cantidad_reservada' => 0,
        ]);
    }

    private function stockDe(Producto $p, ?int $bodegaId = null): float
    {
        return (float) Existencia::where('producto_id', $p->id)
            ->when($bodegaId, fn($q) => $q->where('bodega_id', $bodegaId))
            ->sum('cantidad');
    }

    public function test_pasa_el_stock_por_bodega_promedia_costo_y_desactiva_el_origen(): void
    {
        $destino = $this->producto(['codigo' => '3655', 'costo' => 38]);
        $origen  = $this->producto(['codigo' => '3665', 'costo' => 44]);
        $this->stock($destino, $this->bodegaA, 30);
        $this->stock($origen, $this->bodegaA, 15);
        $this->stock($origen, $this->bodegaB, 5);

        $r = app(InventarioService::class)->unirProductos($origen, $destino, $this->usuarioId);

        $this->assertSame(20.0, $r['unidades_pasadas']);
        // (30 × 38 + 20 × 44) / 50 = 40.40
        $this->assertSame(40.4, $r['costo_final']);
        $this->assertSame(45.0, $this->stockDe($destino, $this->bodegaA));
        $this->assertSame(5.0, $this->stockDe($destino, $this->bodegaB));
        $this->assertSame(0.0, $this->stockDe($origen));
        $this->assertFalse($origen->fresh()->activo);
        $this->assertEquals(40.4, (float) $destino->fresh()->costo);
        // Un ajuste negativo y uno positivo por cada bodega
        $this->assertSame(4, MovimientoInventario::where('tipo_referencia', 'union_producto')->count());
    }

    public function test_si_el_origen_no_tiene_costo_se_conserva_el_del_destino(): void
    {
        $destino = $this->producto(['codigo' => '1004A', 'costo' => 92]);
        $origen  = $this->producto(['codigo' => '1004F', 'costo' => 0]);
        $this->stock($destino, $this->bodegaA, 29);
        $this->stock($origen, $this->bodegaA, 10);

        $r = app(InventarioService::class)->unirProductos($origen, $destino, $this->usuarioId);

        $this->assertSame(92.0, $r['costo_final']);
        $this->assertSame(39.0, $this->stockDe($destino));
    }

    public function test_el_destino_sin_codigo_toma_el_codigo_del_origen(): void
    {
        $destino = $this->producto(['codigo' => null, 'costo' => 65]);
        $origen  = $this->producto(['codigo' => 'E11183', 'costo' => 65, 'precio_venta' => 120]);

        app(InventarioService::class)->unirProductos($origen, $destino, $this->usuarioId);

        $this->assertSame('E11183', $destino->fresh()->codigo);
        $this->assertEquals(120, (float) $destino->fresh()->precio_venta);
        $this->assertNull($origen->fresh()->codigo);
        $this->assertFalse($origen->fresh()->activo);
    }

    public function test_no_permite_unir_un_producto_consigo_mismo_ni_uno_inactivo(): void
    {
        $p = $this->producto(['codigo' => 'A']);
        $inactivo = $this->producto(['codigo' => 'B', 'activo' => false]);
        $servicio = app(InventarioService::class);

        foreach ([[$p, $p], [$inactivo, $p], [$p, $inactivo]] as [$origen, $destino]) {
            try {
                $servicio->unirProductos($origen, $destino, $this->usuarioId);
                $this->fail('Debió rechazar la unión');
            } catch (DomainException) {
                $this->assertTrue($p->fresh()->activo);
            }
        }
    }

    public function test_no_permite_unir_si_hay_unidades_reservadas(): void
    {
        $destino = $this->producto(['codigo' => 'A']);
        $origen  = $this->producto(['codigo' => 'B']);
        Existencia::create([
            'empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaA, 'producto_id' => $origen->id,
            'cantidad' => 5, 'cantidad_reservada' => 2,
        ]);

        try {
            app(InventarioService::class)->unirProductos($origen, $destino, $this->usuarioId);
            $this->fail('Debió rechazar la unión');
        } catch (DomainException) {
            // No se movió nada
            $this->assertSame(5.0, $this->stockDe($origen));
            $this->assertTrue($origen->fresh()->activo);
        }
    }
}
