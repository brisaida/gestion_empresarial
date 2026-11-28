<?php

namespace Tests\Feature;

use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SuperAdminEmpresasTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Rol::create(['nombre' => 'Vendedor', 'modulos' => ['ventas']]);
        Rol::create(['nombre' => 'Administrador', 'modulos' => null]);
        $sa = User::create(['nombre' => 'SA', 'correo' => 'sa@x.com', 'password' => 'x']);
        $sa->forceFill(['es_super_admin' => true])->save();
        $this->actingAs($sa);
    }

    public function test_crea_empresa_con_su_primer_administrador_y_puede_iniciar_sesion(): void
    {
        $r = $this->postJson('/api/sa/empresas', [
            'nombre' => 'Ferretería Sur', 'admin_nombre' => 'Ana', 'admin_correo' => 'ana@sur.com', 'admin_password' => 'clave-segura',
        ])->assertCreated()->json('data');

        $this->assertEquals('ana@sur.com', $r['admin']['correo']);
        $this->assertFalse($r['admin']['existente']);
        $rol = DB::table('usuarios_empresas')->where('empresa_id', $r['id'])->value('rol_id');
        $this->assertEquals('Administrador', Rol::find($rol)->nombre);   // el de acceso total por defecto

        $this->app['auth']->shouldUse('web');   // el login real llega sin token
        $this->postJson('/api/auth/login', ['correo' => 'ana@sur.com', 'password' => 'clave-segura'])
            ->assertOk()->assertJsonPath('data.empresas.0.nombre', 'Ferretería Sur');
    }

    public function test_correo_existente_recibe_acceso_y_sin_clave_no_crea_usuario_nuevo(): void
    {
        User::create(['nombre' => 'Luis', 'correo' => 'luis@x.com', 'password' => 'x']);
        $r = $this->postJson('/api/sa/empresas', ['nombre' => 'Otra', 'admin_nombre' => 'Luis', 'admin_correo' => 'luis@x.com'])
            ->assertCreated()->json('data');
        $this->assertTrue($r['admin']['existente']);

        $this->postJson('/api/sa/empresas', ['nombre' => 'Sin clave', 'admin_nombre' => 'Nuevo', 'admin_correo' => 'nuevo@x.com'])
            ->assertStatus(422);
        $this->assertDatabaseMissing('empresas', ['nombre' => 'Sin clave']);
    }
}
