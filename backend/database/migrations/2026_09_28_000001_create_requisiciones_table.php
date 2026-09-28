<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Requisiciones: pedido de mercadería a un proveedor. Es solo un documento
 * (no mueve inventario ni lleva precios). Las líneas pueden ser productos del
 * catálogo (producto_id) o artículos libres (descripcion).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requisiciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('proveedor_id')->nullable()->constrained('proveedores')->nullOnDelete();
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            $table->string('numero_requisicion', 60);
            $table->date('fecha_requisicion');
            $table->string('realizado_por', 150)->nullable();
            $table->text('observaciones')->nullable();
            $table->enum('estado', ['borrador', 'enviada', 'recibida', 'cancelada'])->default('borrador');
            $table->timestamps();

            $table->unique(['empresa_id', 'numero_requisicion']);
        });

        Schema::create('detalle_requisiciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requisicion_id')->constrained('requisiciones')->cascadeOnDelete();
            $table->foreignId('producto_id')->nullable()->constrained('productos')->restrictOnDelete();
            $table->string('codigo', 60)->nullable();       // código de artículo libre
            $table->string('descripcion', 255)->nullable(); // descripción de artículo libre
            $table->decimal('cantidad', 14, 4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detalle_requisiciones');
        Schema::dropIfExists('requisiciones');
    }
};
