<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Copia de los datos del CAI vigentes al emitir cada factura,
 * para que al reimprimir no cambien si la empresa registra un CAI nuevo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->string('cai', 60)->nullable()->after('numero_factura');
            $table->string('cai_rango_desde', 30)->nullable()->after('cai');
            $table->string('cai_rango_hasta', 30)->nullable()->after('cai_rango_desde');
            $table->date('cai_fecha_limite')->nullable()->after('cai_rango_hasta');
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropColumn(['cai', 'cai_rango_desde', 'cai_rango_hasta', 'cai_fecha_limite']);
        });
    }
};
