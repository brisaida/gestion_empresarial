<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->boolean('exonerado')->default(false)->after('impuesto');
            $table->string('orden_compra_exenta', 60)->nullable()->after('exonerado');
            $table->string('constancia_exonerado', 60)->nullable()->after('orden_compra_exenta');
            $table->string('registro_sag', 60)->nullable()->after('constancia_exonerado');
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropColumn(['exonerado', 'orden_compra_exenta', 'constancia_exonerado', 'registro_sag']);
        });
    }
};
