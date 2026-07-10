<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sesiones_caja', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas');
            $table->foreignId('usuario_id')->constrained('usuarios');
            $table->decimal('monto_inicial', 12, 2)->default(0);
            $table->decimal('monto_cierre', 12, 2)->nullable();
            $table->decimal('diferencia', 12, 2)->nullable();
            $table->decimal('total_ventas', 12, 2)->nullable();
            $table->decimal('total_efectivo', 12, 2)->nullable();
            $table->decimal('total_tarjeta', 12, 2)->nullable();
            $table->decimal('total_transferencia', 12, 2)->nullable();
            $table->decimal('total_mixto', 12, 2)->nullable();
            $table->integer('cantidad_ventas')->nullable();
            $table->enum('estado', ['abierta', 'cerrada'])->default('abierta');
            $table->timestamp('fecha_apertura');
            $table->timestamp('fecha_cierre')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['empresa_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sesiones_caja');
    }
};
