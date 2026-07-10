<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comandas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bodega_id')->constrained()->cascadeOnDelete();
            $table->string('numero_comanda', 20);
            $table->string('mesa', 60)->nullable();
            $table->enum('estado', ['pendiente', 'en_preparacion', 'listo', 'cancelado'])->default('pendiente');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['empresa_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comandas');
    }
};
