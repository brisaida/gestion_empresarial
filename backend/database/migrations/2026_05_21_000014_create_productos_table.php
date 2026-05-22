<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->restrictOnDelete();
            $table->foreignId('categoria_id')->nullable()->constrained('categorias')->nullOnDelete();
            $table->foreignId('marca_id')->nullable()->constrained('marcas')->nullOnDelete();
            $table->foreignId('unidad_medida_id')->nullable()->constrained('unidades_medida')->nullOnDelete();
            $table->string('codigo')->nullable();
            $table->string('codigo_barra')->nullable();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->decimal('costo', 14, 4)->default(0);
            $table->decimal('precio_venta', 14, 4)->default(0);
            $table->decimal('stock_minimo', 14, 4)->default(0);
            $table->boolean('maneja_lote')->default(false);
            $table->boolean('maneja_vencimiento')->default(false);
            $table->boolean('maneja_serie')->default(false);
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['empresa_id', 'codigo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
