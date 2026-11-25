<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tarjetas de crédito de la empresa.
 *
 * cargos_tarjeta es el libro de la tarjeta: cada cargo viene de una requisición, una compra,
 * un pago a proveedor o se registra a mano. Un monto negativo es un crédito (devolución a la tarjeta).
 * pagos_tarjeta son los pagos al banco. Saldo = cargos − pagos (sin anulados).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tarjetas_credito', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->string('nombre', 100);                 // Visa Empresarial
            $table->string('banco', 100);
            $table->char('ultimos4', 4);
            $table->unsignedTinyInteger('dia_corte')->nullable();
            $table->unsignedTinyInteger('dia_pago')->nullable();
            $table->decimal('limite', 14, 2)->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        Schema::create('cargos_tarjeta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('tarjeta_credito_id')->constrained('tarjetas_credito');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->date('fecha');
            $table->decimal('monto', 14, 2);
            $table->string('descripcion', 255);
            $table->string('origen', 20);                  // requisicion · compra · pago_proveedor · devolucion · manual
            $table->foreignId('requisicion_id')->nullable()->constrained('requisiciones');
            $table->foreignId('compra_id')->nullable()->constrained('compras');
            $table->foreignId('pago_compra_id')->nullable()->constrained('pagos_compra');
            $table->foreignId('devolucion_compra_id')->nullable()->constrained('devoluciones_compra');
            $table->boolean('anulado')->default(false);
            $table->timestamps();

            $table->index(['tarjeta_credito_id', 'fecha']);
        });

        Schema::create('pagos_tarjeta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('tarjeta_credito_id')->constrained('tarjetas_credito');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->date('fecha');
            $table->decimal('monto', 14, 2);
            $table->string('metodo_pago', 20)->default('transferencia');
            $table->boolean('desde_caja')->default(false);
            $table->string('referencia', 100)->nullable();
            $table->string('observaciones', 500)->nullable();
            $table->boolean('anulado')->default(false);
            $table->foreignId('anulado_por')->nullable()->constrained('usuarios');
            $table->timestamp('anulado_at')->nullable();
            $table->timestamps();

            $table->index(['tarjeta_credito_id', 'fecha']);
        });

        Schema::table('requisiciones', function (Blueprint $table) {
            $table->string('metodo_pago', 20)->nullable();
            $table->foreignId('tarjeta_credito_id')->nullable()->constrained('tarjetas_credito');
        });

        Schema::table('compras', function (Blueprint $table) {
            $table->foreignId('tarjeta_credito_id')->nullable()->constrained('tarjetas_credito');
            $table->foreignId('requisicion_id')->nullable()->constrained('requisiciones');
        });

        Schema::table('pagos_compra', function (Blueprint $table) {
            $table->foreignId('tarjeta_credito_id')->nullable()->constrained('tarjetas_credito');
        });

        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->decimal('total_pagos_tarjetas', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sesiones_caja', fn(Blueprint $t) => $t->dropColumn('total_pagos_tarjetas'));
        Schema::table('pagos_compra', function (Blueprint $t) { $t->dropForeign(['tarjeta_credito_id']); $t->dropColumn('tarjeta_credito_id'); });
        Schema::table('compras', function (Blueprint $t) {
            $t->dropForeign(['tarjeta_credito_id']); $t->dropForeign(['requisicion_id']);
            $t->dropColumn(['tarjeta_credito_id', 'requisicion_id']);
        });
        Schema::table('requisiciones', function (Blueprint $t) {
            $t->dropForeign(['tarjeta_credito_id']);
            $t->dropColumn(['metodo_pago', 'tarjeta_credito_id']);
        });
        Schema::dropIfExists('pagos_tarjeta');
        Schema::dropIfExists('cargos_tarjeta');
        Schema::dropIfExists('tarjetas_credito');
    }
};
