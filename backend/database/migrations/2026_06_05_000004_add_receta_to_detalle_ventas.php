<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('detalle_ventas', function (Blueprint $table) {
            // Allow producto_id to be null when the line is a recipe
            $table->foreignId('producto_id')->nullable()->change();
            // Add receta_id (null when the line is a regular product)
            $table->foreignId('receta_id')->nullable()->after('producto_id')
                  ->constrained('recetas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('detalle_ventas', function (Blueprint $table) {
            $table->dropForeign(['receta_id']);
            $table->dropColumn('receta_id');
            $table->foreignId('producto_id')->nullable(false)->change();
        });
    }
};
