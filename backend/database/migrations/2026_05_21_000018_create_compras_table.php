<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('compras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->restrictOnDelete();
            $table->foreignId('proveedor_id')->constrained('proveedores')->restrictOnDelete();
            $table->foreignId('bodega_id')->constrained('bodegas')->restrictOnDelete();
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            $table->string('numero_factura')->nullable();
            $table->date('fecha_compra');
            $table->decimal('subtotal', 14, 4)->default(0);
            $table->decimal('impuesto', 14, 4)->default(0);
            $table->decimal('descuento', 14, 4)->default(0);
            $table->decimal('total', 14, 4)->default(0);
            // pendiente, recibida, cancelada
            $table->string('estado', 20)->default('pendiente');
            $table->timestamps();

            $table->index(['empresa_id', 'fecha_compra']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compras');
    }
};
