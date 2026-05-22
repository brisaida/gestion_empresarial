<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transferencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->restrictOnDelete();
            $table->foreignId('bodega_origen_id')->constrained('bodegas')->restrictOnDelete();
            $table->foreignId('bodega_destino_id')->constrained('bodegas')->restrictOnDelete();
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            $table->date('fecha_transferencia');
            // pendiente, completada, cancelada
            $table->string('estado', 20)->default('pendiente');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['empresa_id', 'fecha_transferencia']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transferencias');
    }
};
