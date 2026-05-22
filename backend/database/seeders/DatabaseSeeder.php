<?php

namespace Database\Seeders;

use App\Models\Bodega;
use App\Models\Categoria;
use App\Models\Empresa;
use App\Models\Marca;
use App\Models\Producto;
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
            'nombre'   => 'Administrador',
            'correo'   => 'admin@inventario.com',
            'password' => Hash::make('password'),
            'activo'   => true,
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

        // ── Productos de ejemplo ───────────────────────────────────────────
        $productos = [
            ['nombre' => 'Laptop 15"',         'codigo' => 'P-001', 'costo' => 8500,  'precio_venta' => 12000, 'stock_minimo' => 2,  'categoria_id' => $cats[0]->id, 'marca_id' => $marcas[0]->id],
            ['nombre' => 'Mouse Inalámbrico',   'codigo' => 'P-002', 'costo' => 250,   'precio_venta' => 450,   'stock_minimo' => 5,  'categoria_id' => $cats[0]->id, 'marca_id' => $marcas[0]->id],
            ['nombre' => 'Teclado USB',         'codigo' => 'P-003', 'costo' => 180,   'precio_venta' => 320,   'stock_minimo' => 5,  'categoria_id' => $cats[0]->id],
            ['nombre' => 'Zapatos Deportivos',  'codigo' => 'P-004', 'costo' => 900,   'precio_venta' => 1500,  'stock_minimo' => 3,  'categoria_id' => $cats[1]->id, 'marca_id' => $marcas[1]->id],
            ['nombre' => 'Camiseta Polo',       'codigo' => 'P-005', 'costo' => 150,   'precio_venta' => 280,   'stock_minimo' => 10, 'categoria_id' => $cats[1]->id, 'marca_id' => $marcas[1]->id],
            ['nombre' => 'Arroz 1kg',           'codigo' => 'P-006', 'costo' => 18,    'precio_venta' => 28,    'stock_minimo' => 50, 'categoria_id' => $cats[2]->id, 'marca_id' => $marcas[2]->id],
            ['nombre' => 'Aceite Vegetal 1L',   'codigo' => 'P-007', 'costo' => 42,    'precio_venta' => 65,    'stock_minimo' => 20, 'categoria_id' => $cats[2]->id],
            ['nombre' => 'Martillo 16oz',       'codigo' => 'P-008', 'costo' => 85,    'precio_venta' => 145,   'stock_minimo' => 5,  'categoria_id' => $cats[3]->id, 'marca_id' => $marcas[3]->id],
            ['nombre' => 'Destornillador Set',  'codigo' => 'P-009', 'costo' => 120,   'precio_venta' => 200,   'stock_minimo' => 5,  'categoria_id' => $cats[3]->id],
            ['nombre' => 'Resma de Papel A4',   'codigo' => 'P-010', 'costo' => 75,    'precio_venta' => 120,   'stock_minimo' => 20, 'categoria_id' => $cats[4]->id],
            ['nombre' => 'Bolígrafo Azul x12',  'codigo' => 'P-011', 'costo' => 35,    'precio_venta' => 60,    'stock_minimo' => 30, 'categoria_id' => $cats[4]->id, 'marca_id' => $marcas[4]->id],
            ['nombre' => 'Monitor 24"',         'codigo' => 'P-012', 'costo' => 3200,  'precio_venta' => 4800,  'stock_minimo' => 2,  'categoria_id' => $cats[0]->id, 'marca_id' => $marcas[0]->id],
        ];

        foreach ($productos as $p) {
            Producto::create(array_merge($p, [
                'empresa_id'      => $empresa->id,
                'unidad_medida_id'=> $unidades[0]->id,
                'activo'          => true,
            ]));
        }

        $this->command->info('✓ Seeder completado.');
        $this->command->info('  Usuario: admin@inventario.com | Contraseña: password');
        $this->command->info('  Empresa ID: ' . $empresa->id);
    }
}
