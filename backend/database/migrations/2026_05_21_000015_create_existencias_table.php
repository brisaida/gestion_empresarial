<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('existencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->restrictOnDelete();
            $table->foreignId('bodega_id')->constrained('bodegas')->restrictOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->restrictOnDelete();
            $table->string('lote')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->string('numero_serie')->nullable();
            $table->decimal('cantidad', 14, 4)->default(0);
            $table->decimal('cantidad_reservada', 14, 4)->default(0);
            $table->timestamps();

            $table->index(['empresa_id', 'bodega_id', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('existencias');
    }
};
