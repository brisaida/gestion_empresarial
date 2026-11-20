<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Devoluciones de clientes (sobre ventas) y a proveedores (sobre compras recibidas),
 * con comprobante interno DEV-/DPV- correlativo por empresa.
 *
 * monto_devuelto   = total de todas las devoluciones del documento
 * devuelto_a_saldo = la parte que se descontó del saldo de crédito (no se reembolsó)
 *
 * Cancelaciones: quién, cuándo y por qué.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['ventas', 'compras'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->decimal('monto_devuelto', 14, 4)->default(0);
                $table->decimal('devuelto_a_saldo', 14, 4)->default(0);
                $table->foreignId('cancelada_por')->nullable()->constrained('usuarios');
                $table->timestamp('cancelada_at')->nullable();
                $table->string('motivo_cancelacion', 500)->nullable();
            });
        }

        Schema::create('devoluciones_venta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('venta_id')->constrained('ventas');
            $table->foreignId('cliente_id')->nullable()->constrained('clientes');
            $table->foreignId('bodega_id')->nullable()->constrained('bodegas');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->string('numero', 20);
            $table->date('fecha');
            $table->string('motivo', 500);
            $table->decimal('subtotal', 14, 4)->default(0);
            $table->decimal('impuesto', 14, 4)->default(0);
            $table->decimal('total', 14, 4)->default(0);
            $table->decimal('aplicado_a_saldo', 14, 4)->default(0);
            $table->decimal('reembolsado', 14, 4)->default(0);
            $table->string('reembolso_metodo', 20)->nullable();   // efectivo · tarjeta · transferencia · cambio
            $table->boolean('desde_caja')->default(false);
            $table->timestamps();

            $table->unique(['empresa_id', 'numero']);
            $table->index(['empresa_id', 'created_at']);
        });

        Schema::create('detalle_devoluciones_venta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('devolucion_venta_id')->constrained('devoluciones_venta')->cascadeOnDelete();
            $table->foreignId('detalle_venta_id')->constrained('detalle_ventas');
            $table->foreignId('producto_id')->nullable()->constrained('productos');
            $table->foreignId('receta_id')->nullable()->constrained('recetas');
            $table->string('descripcion')->nullable();
            $table->decimal('cantidad', 14, 4);
            $table->decimal('precio_unitario', 14, 4);
            $table->decimal('subtotal', 14, 4);
            $table->boolean('regresa_a_stock')->default(true);
            $table->timestamps();
        });

        Schema::create('devoluciones_compra', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('compra_id')->constrained('compras');
            $table->foreignId('proveedor_id')->nullable()->constrained('proveedores');
            $table->foreignId('bodega_id')->nullable()->constrained('bodegas');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->string('numero', 20);
            $table->date('fecha');
            $table->string('motivo', 500);
            $table->decimal('subtotal', 14, 4)->default(0);
            $table->decimal('impuesto', 14, 4)->default(0);
            $table->decimal('total', 14, 4)->default(0);
            $table->decimal('aplicado_a_saldo', 14, 4)->default(0);
            $table->decimal('reembolsado', 14, 4)->default(0);
            $table->string('reembolso_metodo', 20)->nullable();   // efectivo · transferencia · cambio
            $table->boolean('desde_caja')->default(false);
            $table->timestamps();

            $table->unique(['empresa_id', 'numero']);
            $table->index(['empresa_id', 'created_at']);
        });

        Schema::create('detalle_devoluciones_compra', function (Blueprint $table) {
            $table->id();
            $table->foreignId('devolucion_compra_id')->constrained('devoluciones_compra')->cascadeOnDelete();
            $table->foreignId('detalle_compra_id')->constrained('detalle_compras');
            $table->foreignId('producto_id')->constrained('productos');
            $table->decimal('cantidad', 14, 4);
            $table->decimal('costo_unitario', 14, 4);
            $table->decimal('subtotal', 14, 4);
            $table->timestamps();
        });

        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->decimal('total_reembolsos_clientes', 12, 2)->nullable();
            $table->decimal('total_reembolsos_proveedores', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->dropColumn(['total_reembolsos_clientes', 'total_reembolsos_proveedores']);
        });
        Schema::dropIfExists('detalle_devoluciones_compra');
        Schema::dropIfExists('devoluciones_compra');
        Schema::dropIfExists('detalle_devoluciones_venta');
        Schema::dropIfExists('devoluciones_venta');
        foreach (['ventas', 'compras'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->dropForeign(['cancelada_por']);
                $table->dropColumn(['monto_devuelto', 'devuelto_a_saldo', 'cancelada_por', 'cancelada_at', 'motivo_cancelacion']);
            });
        }
    }
};
