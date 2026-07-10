<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comandas', function (Blueprint $table) {
            $table->foreignId('mesa_id')
                ->nullable()
                ->constrained('mesas')
                ->nullOnDelete()
                ->after('bodega_id');
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->enum('metodo_pago', ['efectivo', 'tarjeta', 'transferencia', 'mixto'])
                ->default('efectivo')
                ->after('estado');
        });
    }

    public function down(): void
    {
        Schema::table('comandas', function (Blueprint $table) {
            $table->dropForeign(['mesa_id']);
            $table->dropColumn('mesa_id');
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->dropColumn('metodo_pago');
        });
    }
};
