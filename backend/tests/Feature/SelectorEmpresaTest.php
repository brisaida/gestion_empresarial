<?php

namespace Tests\Feature;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SelectorEmpresaTest extends TestCase
{
    use RefreshDatabase;

    public function test_lista_las_empresas_activas_del_usuario_con_sus_permisos_actuales(): void
    {
        $vendedor = Rol::create(['nombre' => 'Vendedor', 'modulos' => ['ventas']]);
        $admin    = Rol::create(['nombre' => 'Administrador', 'modulos' => null]);
        $a = DB::table('empresas')->insertGetId(['nombre' => 'Bodega Norte', 'nombre_legal' => 'N', 'activo' => true]);
        $b = DB::table('empresas')->insertGetId(['nombre' => 'Almacén Sur', 'nombre_legal' => 'S', 'activo' => true]);
        $c = DB::table('empresas')->insertGetId(['nombre' => 'Cerrada', 'nombre_legal' => 'C', 'activo' => false]);

        $u = User::create(['nombre' => 'Ana', 'correo' => 'ana@x.com', 'password' => 'x']);
        foreach ([[$a, $vendedor->id], [$b, $admin->id], [$c, $admin->id]] as [$emp, $rol]) {
            DB::table('usuarios_empresas')->insert(['usuario_id' => $u->id, 'empresa_id' => $emp, 'rol_id' => $rol, 'activo' => true]);
        }
        $this->actingAs($u);

        $lista = $this->getJson('/api/auth/empresas')->assertOk()->json('data');
        $this->assertEquals(['Almacén Sur', 'Bodega Norte'], array_column($lista, 'nombre'));   // sin la desactivada, en orden
        $this->assertEquals(['ventas'], $lista[1]['modulos']);

        // Le cambian el rol: el siguiente refresco ya trae los permisos nuevos
        DB::table('usuarios_empresas')->where('empresa_id', $a)->update(['rol_id' => $admin->id]);
        $this->assertNull($this->getJson('/api/auth/empresas')->json('data.1.modulos'));
    }
}
