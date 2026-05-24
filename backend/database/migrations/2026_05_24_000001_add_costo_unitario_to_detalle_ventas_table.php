<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('detalle_ventas', function (Blueprint $table) {
            // Costo del producto al momento de la venta (para calcular margen / COGS)
            $table->decimal('costo_unitario', 14, 4)->default(0)->after('precio_unitario');
        });
    }

    public function down(): void
    {
        Schema::table('detalle_ventas', function (Blueprint $table) {
            $table->dropColumn('costo_unitario');
        });
    }
};
