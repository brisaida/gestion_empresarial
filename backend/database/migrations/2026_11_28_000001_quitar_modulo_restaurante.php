<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Se quita el módulo de restaurante (mesas, comandas, cocina, recetas e ingredientes).
 * El código queda en el historial de git (etiqueta `restaurante-respaldo`) por si se retoma aparte.
 * En producción no había datos: 0 recetas, 0 mesas, 0 comandas, 0 ventas con receta, todos los productos tipo "venta".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('detalle_comandas');
        Schema::dropIfExists('comandas');
        Schema::dropIfExists('mesas');

        Schema::table('detalle_devoluciones_venta', function (Blueprint $table) {
            $table->dropForeign(['receta_id']);
            $table->dropColumn('receta_id');
        });
        Schema::table('detalle_ventas', function (Blueprint $table) {
            $table->dropForeign(['receta_id']);
            $table->dropColumn('receta_id');
        });
        Schema::dropIfExists('receta_ingredientes');
        Schema::dropIfExists('recetas');

        Schema::table('productos', function (Blueprint $table) {
            $table->dropColumn('tipo');
        });

        DB::table('empresas')->where('rubro', 'restaurante')->update(['rubro' => null]);
    }

    public function down(): void
    {
        // Vuelve a crear la estructura con las migraciones originales (sin datos)
        foreach ([
            '2026_06_05_000002_create_recetas_table.php',
            '2026_06_05_000003_create_receta_ingredientes_table.php',
            '2026_07_08_000002_create_comandas_table.php',
            '2026_07_08_000003_create_detalle_comandas_table.php',
            '2026_07_08_000004_create_mesas_table.php',
        ] as $archivo) {
            (require database_path("migrations/{$archivo}"))->up();
        }

        Schema::table('comandas', function (Blueprint $table) {
            $table->foreignId('mesa_id')->nullable()->after('bodega_id')->constrained('mesas')->nullOnDelete();
        });
        Schema::table('detalle_ventas', function (Blueprint $table) {
            $table->foreignId('receta_id')->nullable()->after('producto_id')->constrained('recetas')->nullOnDelete();
        });
        Schema::table('detalle_devoluciones_venta', function (Blueprint $table) {
            $table->foreignId('receta_id')->nullable()->after('producto_id')->constrained('recetas');
        });
        Schema::table('productos', function (Blueprint $table) {
            $table->enum('tipo', ['venta', 'ingrediente'])->default('venta')->after('activo');
        });
    }
};
