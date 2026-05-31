<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            // null = usa la tasa de la empresa; valor explícito = sobreescribe (ej: 18 para alcohol)
            $table->decimal('tasa_isv', 5, 2)->nullable()->after('precio_venta');
        });
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropColumn('tasa_isv');
        });
    }
};
