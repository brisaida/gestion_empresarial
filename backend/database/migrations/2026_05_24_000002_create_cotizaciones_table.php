<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cotizaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();
            $table->foreignId('usuario_id')->constrained('usuarios')->restrictOnDelete();
            $table->foreignId('venta_id')->nullable()->constrained('ventas')->nullOnDelete(); // cuando se convierte
            $table->string('numero_cotizacion', 60)->unique();
            $table->date('fecha_cotizacion');
            $table->date('fecha_vencimiento')->nullable();
            $table->text('observaciones')->nullable();
            $table->decimal('subtotal',  14, 4)->default(0);
            $table->decimal('descuento', 14, 4)->default(0);
            $table->decimal('impuesto',  14, 4)->default(0);
            $table->decimal('total',     14, 4)->default(0);
            $table->enum('estado', ['borrador','enviada','aprobada','rechazada','convertida','vencida'])
                  ->default('borrador');
            $table->timestamps();
        });

        Schema::create('detalle_cotizaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cotizacion_id')->constrained('cotizaciones')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->restrictOnDelete();
            $table->decimal('cantidad',        14, 4);
            $table->decimal('precio_unitario', 14, 4);
            $table->decimal('subtotal',        14, 4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detalle_cotizaciones');
        Schema::dropIfExists('cotizaciones');
    }
};
