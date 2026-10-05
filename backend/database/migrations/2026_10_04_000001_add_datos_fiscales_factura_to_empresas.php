<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('cai', 60)->nullable()->after('tipo_facturacion');
            $table->string('factura_rango_desde', 30)->nullable()->after('cai');
            $table->string('factura_rango_hasta', 30)->nullable()->after('factura_rango_desde');
            $table->date('factura_fecha_limite')->nullable()->after('factura_rango_hasta');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['cai', 'factura_rango_desde', 'factura_rango_hasta', 'factura_fecha_limite']);
        });
    }
};
