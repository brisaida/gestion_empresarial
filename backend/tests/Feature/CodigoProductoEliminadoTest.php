<?php

namespace Tests\Feature;

use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CodigoProductoEliminadoTest extends TestCase
{
    use RefreshDatabase;

    public function test_el_codigo_de_un_producto_eliminado_se_puede_reusar(): void
    {
        $empresaId = DB::table('empresas')->insertGetId(['nombre' => 'Prueba', 'nombre_legal' => 'Prueba SA']);
        $user = User::create(['nombre' => 'Admin', 'correo' => 'a@a.com', 'password' => 'x']);
        $user->forceFill(['es_super_admin' => true])->save();
        $base = ['empresa_id' => $empresaId, 'nombre' => 'Interruptor', 'costo' => 38, 'precio_venta' => 88];

        $eliminado = Producto::create($base + ['codigo' => '3655', 'activo' => false]);
        $activo    = Producto::create($base + ['codigo' => '3665', 'activo' => true]);
        $otro      = Producto::create($base + ['codigo' => '9999', 'activo' => true]);

        // Un código de un producto activo sigue bloqueado
        $this->actingAs($user)->putJson("/api/productos/{$activo->id}", ['codigo' => '9999'])->assertStatus(422);

        // El de un producto eliminado se libera
        $this->putJson("/api/productos/{$activo->id}", ['codigo' => '3655'])->assertOk();
        $this->assertSame('3655', $activo->fresh()->codigo);
        $this->assertNull($eliminado->fresh()->codigo);
        $this->assertSame('9999', $otro->fresh()->codigo);
    }
}
