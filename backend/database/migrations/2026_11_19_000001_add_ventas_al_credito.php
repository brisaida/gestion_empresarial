<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ventas al crédito y cuentas por cobrar.
 *
 * - empresas.dias_credito: plazo por defecto (30 días) para ventas al crédito.
 * - clientes.limite_credito (null = sin límite) y clientes.dias_credito (null = usa el de la empresa).
 * - ventas.condicion contado/credito, plazo, vencimiento y saldo pendiente.
 *   En una venta al crédito metodo_pago no aplica: cuenta lo que entra por abonos.
 * - abonos_venta: pagos parciales o totales a una venta al crédito.
 * - sesiones_caja: totales de crédito y abonos para el historial de cierres.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->unsignedSmallInteger('dias_credito')->default(30);
        });

        Schema::table('clientes', function (Blueprint $table) {
            $table->decimal('limite_credito', 14, 2)->nullable();
            $table->unsignedSmallInteger('dias_credito')->nullable();
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->string('condicion', 10)->default('contado');
            $table->unsignedSmallInteger('dias_credito')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->decimal('saldo_pendiente', 14, 4)->default(0);
            $table->index(['empresa_id', 'condicion']);
        });

        Schema::create('abonos_venta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();
            $table->foreignId('cliente_id')->nullable()->constrained('clientes');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->date('fecha');
            $table->decimal('monto', 14, 2);
            $table->string('metodo_pago', 20)->default('efectivo');
            $table->string('referencia', 100)->nullable();
            $table->string('observaciones', 500)->nullable();
            $table->boolean('anulado')->default(false);
            $table->foreignId('anulado_por')->nullable()->constrained('usuarios');
            $table->timestamp('anulado_at')->nullable();
            $table->timestamps();

            $table->index(['empresa_id', 'created_at']);
        });

        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->decimal('total_credito', 12, 2)->nullable();
            $table->decimal('total_abonos', 12, 2)->nullable();
            $table->decimal('total_abonos_efectivo', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->dropColumn(['total_credito', 'total_abonos', 'total_abonos_efectivo']);
        });

        Schema::dropIfExists('abonos_venta');

        Schema::table('ventas', function (Blueprint $table) {
            $table->dropIndex(['empresa_id', 'condicion']);
            $table->dropColumn(['condicion', 'dias_credito', 'fecha_vencimiento', 'saldo_pendiente']);
        });

        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn(['limite_credito', 'dias_credito']);
        });

        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn('dias_credito');
        });
    }
};
