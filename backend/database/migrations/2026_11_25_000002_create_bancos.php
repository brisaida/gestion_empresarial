<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cuentas bancarias de la empresa (lempiras o dólares) y su libro de movimientos.
 *
 * Los movimientos se generan solos desde ventas, abonos, compras, pagos a proveedores,
 * pagos de tarjetas y devoluciones cuando se pagan por banco y tienen cuenta asignada;
 * también hay depósitos de caja, transferencias entre cuentas y movimientos manuales
 * con categorías que define cada empresa. conciliado = aparece en el estado de cuenta.
 */
return new class extends Migration
{
    private array $documentos = ['ventas', 'abonos_venta', 'compras', 'pagos_compra', 'pagos_tarjeta', 'devoluciones_venta', 'devoluciones_compra'];

    public function up(): void
    {
        Schema::create('cuentas_bancarias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->string('banco', 100);
            $table->string('nombre', 100);                       // Cuenta operativa, Planilla…
            $table->string('tipo', 20)->default('corriente');    // corriente · ahorro
            $table->char('ultimos4', 4);
            $table->char('moneda', 3)->default('HNL');           // HNL · USD
            $table->decimal('saldo_inicial', 14, 2)->default(0);
            $table->date('fecha_saldo_inicial')->nullable();
            $table->decimal('comision_pos_pct', 5, 2)->nullable(); // % que cobra el banco por ventas con tarjeta
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        Schema::create('categorias_banco', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->string('nombre', 100);
            $table->string('tipo', 10)->default('ambos');        // entrada · salida · ambos
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        Schema::create('movimientos_banco', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('cuenta_bancaria_id')->constrained('cuentas_bancarias');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->date('fecha');
            $table->string('tipo', 10);                          // entrada · salida
            $table->decimal('monto', 14, 2);                     // siempre positivo
            $table->string('descripcion', 255);
            $table->string('origen', 25);                        // venta, abono, compra, pago_proveedor, pago_tarjeta, devolucion_venta, devolucion_compra, comision_pos, deposito_caja, transferencia, manual
            $table->string('referencia', 100)->nullable();
            $table->foreignId('categoria_banco_id')->nullable()->constrained('categorias_banco');
            $table->foreignId('venta_id')->nullable()->constrained('ventas');
            $table->foreignId('abono_venta_id')->nullable()->constrained('abonos_venta');
            $table->foreignId('compra_id')->nullable()->constrained('compras');
            $table->foreignId('pago_compra_id')->nullable()->constrained('pagos_compra');
            $table->foreignId('pago_tarjeta_id')->nullable()->constrained('pagos_tarjeta');
            $table->foreignId('devolucion_venta_id')->nullable()->constrained('devoluciones_venta');
            $table->foreignId('devolucion_compra_id')->nullable()->constrained('devoluciones_compra');
            $table->uuid('grupo')->nullable();                   // une las dos patas de una transferencia
            $table->boolean('desde_caja')->default(false);       // depósito con efectivo de la caja
            $table->boolean('conciliado')->default(false);
            $table->timestamp('conciliado_at')->nullable();
            $table->boolean('anulado')->default(false);
            $table->timestamps();

            $table->index(['cuenta_bancaria_id', 'fecha']);
            $table->index(['empresa_id', 'created_at']);
        });

        foreach ($this->documentos as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->foreignId('cuenta_bancaria_id')->nullable()->constrained('cuentas_bancarias');
            });
        }

        Schema::table('empresas', function (Blueprint $table) {
            // { cuenta_tarjeta_id, cuenta_transferencia_id, cuenta_pagos_id }
            $table->json('config_bancos')->nullable();
        });

        Schema::table('sesiones_caja', function (Blueprint $table) {
            $table->decimal('total_depositos_banco', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sesiones_caja', fn(Blueprint $t) => $t->dropColumn('total_depositos_banco'));
        Schema::table('empresas', fn(Blueprint $t) => $t->dropColumn('config_bancos'));
        foreach ($this->documentos as $tabla) {
            Schema::table($tabla, function (Blueprint $t) {
                $t->dropForeign(['cuenta_bancaria_id']);
                $t->dropColumn('cuenta_bancaria_id');
            });
        }
        Schema::dropIfExists('movimientos_banco');
        Schema::dropIfExists('categorias_banco');
        Schema::dropIfExists('cuentas_bancarias');
    }
};
