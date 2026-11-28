<?php

namespace Tests\Feature;

use App\Models\Bitacora;
use App\Models\Existencia;
use App\Models\Producto;
use App\Models\Rol;
use App\Models\User;
use App\Services\BitacoraService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BitacoraTest extends TestCase
{
    use RefreshDatabase;

    private int $empresaId;
    private int $bodegaId;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        BitacoraService::reiniciar();
        $this->empresaId = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA']);
        $this->bodegaId  = DB::table('bodegas')->insertGetId(['empresa_id' => $this->empresaId, 'nombre' => 'Tienda']);
        $this->admin = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'secreto123']);
        $this->admin->forceFill(['es_super_admin' => true])->save();
        $this->actingAs($this->admin);
    }

    private function filas(array $filtros = []): array
    {
        $q = http_build_query($filtros + ['empresa_id' => $this->empresaId]);
        return $this->getJson("/api/bitacora?{$q}")->assertOk()->json('data');
    }

    public function test_registra_crear_editar_con_valores_y_eliminar_producto(): void
    {
        $id = $this->postJson('/api/productos', [
            'empresa_id' => $this->empresaId, 'codigo' => '3655', 'nombre' => 'Cable HDMI', 'costo' => 50, 'precio_venta' => 100,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/productos/{$id}", [
            'empresa_id' => $this->empresaId, 'codigo' => '3655', 'nombre' => 'Cable HDMI', 'costo' => 50, 'precio_venta' => 120,
        ])->assertOk();
        $this->deleteJson("/api/productos/{$id}?empresa_id={$this->empresaId}")->assertOk();

        $filas = $this->filas(['entidad_tipo' => 'Producto', 'entidad_id' => $id]);
        $this->assertEquals(['eliminar', 'editar', 'crear'], array_column($filas, 'accion'));
        $this->assertEquals('Admin', $filas[0]['usuario']['nombre']);

        $edicion = $filas[1];
        $this->assertStringContainsString('Producto 3655 · Cable HDMI: precio de venta', $edicion['descripcion']);
        $this->assertEquals([['campo' => 'precio_venta', 'etiqueta' => 'Precio de venta', 'antes' => 100, 'despues' => 120]], $edicion['cambios']);
    }

    public function test_una_venta_queda_en_una_sola_fila_y_su_cancelacion_con_motivo(): void
    {
        $p = Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Panel', 'costo' => 50, 'precio_venta' => 100, 'activo' => true]);
        Existencia::create(['empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'producto_id' => $p->id, 'cantidad' => 10, 'cantidad_reservada' => 0]);

        $venta = $this->postJson('/api/ventas', [
            'empresa_id' => $this->empresaId, 'bodega_id' => $this->bodegaId, 'fecha_venta' => today()->toDateString(), 'metodo_pago' => 'efectivo',
            'detalles' => [['producto_id' => $p->id, 'cantidad' => 2, 'precio_unitario' => 100]],
        ])->assertCreated()->json('data');
        $this->postJson("/api/ventas/{$venta['id']}/cancelar", ['motivo' => 'Cliente se arrepintió'])->assertOk();

        $filas = $this->filas(['modulo' => 'ventas']);
        $this->assertEquals(['cancelar', 'crear'], array_column($filas, 'accion'));
        $this->assertStringContainsString('Cliente se arrepintió', $filas[0]['descripcion']);
        $total = collect($filas[1]['cambios'])->firstWhere('campo', 'total');
        $this->assertGreaterThan(0, $total['despues']);                        // la fila "crear" tiene los totales finales

        // El stock que mueve la venta no se registra como ajuste manual
        $this->assertCount(0, $this->filas(['modulo' => 'inventario']));
    }

    public function test_inicios_de_sesion_y_contrasenas_ocultas(): void
    {
        $this->postJson('/api/auth/login', ['correo' => 'a@a.com', 'password' => 'malo'])->assertStatus(401);
        $this->postJson('/api/auth/login', ['correo' => 'a@a.com', 'password' => 'secreto123'])->assertOk();

        $sesion = Bitacora::where('modulo', 'sesion')->orderBy('id')->pluck('accion')->all();
        $this->assertEquals(['login_fallido', 'login'], $sesion);

        $this->admin->update(['password' => 'otra-clave']);
        $fila = Bitacora::where('entidad_tipo', 'User')->latest('id')->first();
        $this->assertEquals('••••', $fila->valores_nuevos['password']);
        $this->assertNull($fila->empresa_id);                                   // evento global: solo lo ve el super admin
    }

    public function test_cada_empresa_ve_solo_lo_suyo_y_requiere_permiso_configuracion(): void
    {
        $otra = DB::table('empresas')->insertGetId(['nombre' => 'Otra', 'nombre_legal' => 'Otra SA']);
        Producto::create(['empresa_id' => $otra, 'nombre' => 'Ajeno', 'costo' => 1, 'precio_venta' => 2, 'activo' => true]);
        Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'Propio', 'costo' => 1, 'precio_venta' => 2, 'activo' => true]);

        $filas = $this->filas();
        $this->assertCount(1, $filas);
        $this->assertStringContainsString('Propio', $filas[0]['descripcion']);
        $this->assertCount(2, $this->getJson('/api/sa/bitacora?modulo=catalogos')->assertOk()->json('data'));

        $rol = Rol::create(['nombre' => 'Cajero', 'modulos' => ['ventas']]);
        $cajero = User::create(['nombre' => 'Cajero', 'correo' => 'c@c.com', 'password' => 'x']);
        DB::table('usuarios_empresas')->insert(['usuario_id' => $cajero->id, 'empresa_id' => $this->empresaId, 'rol_id' => $rol->id, 'activo' => true]);
        $this->actingAs($cajero);
        $this->getJson("/api/bitacora?empresa_id={$this->empresaId}")->assertForbidden();
    }

    public function test_importar_y_borrado_masivo_dejan_resumen(): void
    {
        $ids = collect(['A', 'B'])->map(fn($n) => Producto::create(['empresa_id' => $this->empresaId, 'nombre' => $n, 'costo' => 1, 'precio_venta' => 2, 'activo' => true])->id);
        Bitacora::query()->delete();

        $this->postJson('/api/productos/eliminar-masivo', ['empresa_id' => $this->empresaId, 'ids' => $ids->all()])->assertOk();
        $filas = $this->filas();
        $this->assertEquals(['eliminar', 'eliminar'], array_column($filas, 'accion'));

        BitacoraService::pausar(fn() => Producto::create(['empresa_id' => $this->empresaId, 'nombre' => 'C', 'costo' => 1, 'precio_venta' => 2, 'activo' => true]));
        $this->assertCount(2, $this->filas());                                  // en pausa no se registra
    }
}
