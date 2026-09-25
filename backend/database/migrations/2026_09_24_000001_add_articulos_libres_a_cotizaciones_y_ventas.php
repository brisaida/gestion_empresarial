<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Artículos libres: líneas de cotización (y de la venta que se genera al convertirla)
 * que no corresponden a un producto del catálogo. Se identifican por producto_id = null
 * + descripcion, y no mueven inventario.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('detalle_cotizaciones', function (Blueprint $table) {
            $table->foreignId('producto_id')->nullable()->change();
            $table->string('descripcion', 255)->nullable()->after('producto_id');
        });

        Schema::table('detalle_ventas', function (Blueprint $table) {
            $table->string('descripcion', 255)->nullable()->after('receta_id');
        });
    }

    public function down(): void
    {
        Schema::table('detalle_ventas', function (Blueprint $table) {
            $table->dropColumn('descripcion');
        });

        Schema::table('detalle_cotizaciones', function (Blueprint $table) {
            $table->dropColumn('descripcion');
            $table->foreignId('producto_id')->nullable(false)->change();
        });
    }
};
