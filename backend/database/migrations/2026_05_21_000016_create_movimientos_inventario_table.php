<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimientos_inventario', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->restrictOnDelete();
            $table->foreignId('bodega_id')->constrained('bodegas')->restrictOnDelete();
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            // entrada, salida, ajuste_positivo, ajuste_negativo
            $table->string('tipo_movimiento', 30);
            // compra, venta, transferencia, ajuste_manual
            $table->string('tipo_referencia', 30)->nullable();
            $table->unsignedBigInteger('referencia_id')->nullable();
            $table->string('numero_documento')->nullable();
            $table->date('fecha');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['empresa_id', 'fecha']);
            $table->index(['tipo_referencia', 'referencia_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_inventario');
    }
};
