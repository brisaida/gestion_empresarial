<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Compras al crédito y cuentas por pagar.
 *
 * - proveedores.dias_credito: plazo que da el proveedor (null = usa empresas.dias_credito).
 * - compras: condición contado/crédito, método de pago (contado), plazo, vencimiento y saldo.
 * - pagos_compra: pagos parciales o totales a una compra al crédito. desde_caja = el efectivo
 *   salió de la caja abierta y se resta del efectivo esperado.
 * - sesiones_caja.total_pagos_proveedores: lo pagado desde caja, para el historial.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proveedores', function (Blueprint $table) {
            $table->unsignedSmallInteger('dias_credito')->nullable();
        });

        Schema::table('compras', function (Blueprint $table) {
            $table->string('condicion', 10)->default('contado');
            $table->string('metodo_pago', 20)->nullable();
            $table->unsignedSmallInteger('dias_credito')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->decimal('saldo_pendiente', 14, 4)->default(0);
            $table->index(['empresa_id', 'condicion']);
        });

        Schema::create('pagos_compra', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('compra_id')->constrained('compras')->cascadeOnDelete();
            $table->foreignId('proveedor_id')->nullable()->constrained('proveedores');
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

            $table->index(['empresa_id', 'created_at']);
        });

        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->decimal('total_pagos_proveedores', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->dropColumn('total_pagos_proveedores');
        });

        Schema::dropIfExists('pagos_compra');

        Schema::table('compras', function (Blueprint $table) {
            $table->dropIndex(['empresa_id', 'condicion']);
            $table->dropColumn(['condicion', 'metodo_pago', 'dias_credito', 'fecha_vencimiento', 'saldo_pendiente']);
        });

        Schema::table('proveedores', function (Blueprint $table) {
            $table->dropColumn('dias_credito');
        });
    }
};
