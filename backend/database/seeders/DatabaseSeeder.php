<?php

namespace Database\Seeders;

use App\Models\Bodega;
use App\Models\Categoria;
use App\Models\Empresa;
use App\Models\Marca;
use App\Models\Proveedor;
use App\Models\Rol;
use App\Models\UnidadMedida;
use App\Models\User;
use App\Models\UsuarioEmpresa;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Empresa ────────────────────────────────────────────────────────
        $empresa = Empresa::create([
            'nombre'       => 'Mi Empresa Demo',
            'nombre_legal' => 'Mi Empresa Demo S.A.',
            'rtn'          => '0801-1990-00001',
            'correo'       => 'info@mempresa.com',
            'telefono'     => '2222-0000',
            'direccion'    => 'Tegucigalpa, Honduras',
            'activo'       => true,
        ]);

        // ── Roles ──────────────────────────────────────────────────────────
        $rolAdmin   = Rol::create(['nombre' => 'Administrador', 'descripcion' => 'Acceso total al sistema']);
        $rolVendedor= Rol::create(['nombre' => 'Vendedor',      'descripcion' => 'Puede registrar ventas y consultar inventario']);
        $rolBodega  = Rol::create(['nombre' => 'Bodeguero',     'descripcion' => 'Gestión de inventario y bodegas']);

        // ── Usuario admin ──────────────────────────────────────────────────
        $admin = User::create([
            'nombre'         => 'Administrador',
            'correo'         => 'admin@inventario.com',
            'password'       => Hash::make('password'),
            'activo'         => true,
            'es_super_admin' => true,
        ]);

        UsuarioEmpresa::create([
            'usuario_id' => $admin->id,
            'empresa_id' => $empresa->id,
            'rol_id'     => $rolAdmin->id,
            'activo'     => true,
        ]);

        // ── Bodega ─────────────────────────────────────────────────────────
        $bodega = Bodega::create([
            'empresa_id' => $empresa->id,
            'codigo'     => 'BOD-01',
            'nombre'     => 'Bodega Principal',
            'activo'     => true,
        ]);

        // ── Categorías ─────────────────────────────────────────────────────
        $cats = collect(['Electrónica', 'Ropa y Calzado', 'Alimentos', 'Herramientas', 'Oficina'])->map(fn($n) =>
            Categoria::create(['empresa_id' => $empresa->id, 'nombre' => $n, 'activo' => true])
        );

        // ── Marcas ─────────────────────────────────────────────────────────
        $marcas = collect(['Samsung', 'Nike', 'Nestlé', 'Truper', 'Pilot'])->map(fn($n) =>
            Marca::create(['empresa_id' => $empresa->id, 'nombre' => $n, 'activo' => true])
        );

        // ── Unidades de medida ─────────────────────────────────────────────
        $uds = [
            ['nombre' => 'Unidad',     'abreviatura' => 'UND'],
            ['nombre' => 'Caja',       'abreviatura' => 'CJA'],
            ['nombre' => 'Kilogramo',  'abreviatura' => 'KG'],
            ['nombre' => 'Litro',      'abreviatura' => 'LT'],
            ['nombre' => 'Metro',      'abreviatura' => 'MT'],
        ];
        $unidades = collect($uds)->map(fn($u) =>
            UnidadMedida::create(array_merge($u, ['empresa_id' => $empresa->id, 'activo' => true]))
        );

        // ── Proveedores ────────────────────────────────────────────────────
        collect([
            ['nombre' => 'Distribuidora Central', 'correo' => 'ventas@distcentral.com', 'telefono' => '2233-4455'],
            ['nombre' => 'Importaciones HN',      'correo' => 'compras@imphn.com',      'telefono' => '2288-9900'],
            ['nombre' => 'Proveedores del Norte',  'correo' => 'info@provnorte.com',     'telefono' => '2244-7766'],
        ])->each(fn($p) => Proveedor::create(array_merge($p, ['empresa_id' => $empresa->id, 'activo' => true])));

$this->command->info('✓ Seeder completado.');
        $this->command->info('  Usuario: admin@inventario.com | Contraseña: password');
        $this->command->info('  Empresa ID: ' . $empresa->id);
    }
}
