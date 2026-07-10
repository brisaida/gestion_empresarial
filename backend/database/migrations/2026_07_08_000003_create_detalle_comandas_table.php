<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('detalle_comandas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comanda_id')->constrained()->cascadeOnDelete();
            $table->foreignId('producto_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('receta_id')->nullable()->constrained()->nullOnDelete();
            $table->string('nombre_item', 200);
            $table->decimal('cantidad', 10, 3);
            $table->decimal('precio_unitario', 12, 4);
            $table->string('notas', 500)->nullable();
            $table->boolean('listo')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detalle_comandas');
    }
};
