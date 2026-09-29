<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Requisiciones con precios: condición de pago (crédito/contado), precio por
 * línea (sin ISV) y totales. Sigue sin mover inventario.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requisiciones', function (Blueprint $table) {
            $table->string('condicion', 20)->nullable()->after('realizado_por');
            $table->decimal('subtotal', 14, 4)->default(0)->after('observaciones');
            $table->decimal('impuesto', 14, 4)->default(0)->after('subtotal');
            $table->decimal('total',    14, 4)->default(0)->after('impuesto');
        });

        Schema::table('detalle_requisiciones', function (Blueprint $table) {
            $table->decimal('precio_unitario', 14, 4)->default(0)->after('cantidad');
            $table->decimal('subtotal',        14, 4)->default(0)->after('precio_unitario');
        });
    }

    public function down(): void
    {
        Schema::table('detalle_requisiciones', function (Blueprint $table) {
            $table->dropColumn(['precio_unitario', 'subtotal']);
        });

        Schema::table('requisiciones', function (Blueprint $table) {
            $table->dropColumn(['condicion', 'subtotal', 'impuesto', 'total']);
        });
    }
};
