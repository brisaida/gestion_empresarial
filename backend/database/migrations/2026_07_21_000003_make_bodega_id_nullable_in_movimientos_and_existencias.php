<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movimientos_inventario', function (Blueprint $table) {
            $table->foreignId('bodega_id')->nullable()->change();
        });

        Schema::table('existencias', function (Blueprint $table) {
            $table->foreignId('bodega_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('movimientos_inventario', function (Blueprint $table) {
            $table->foreignId('bodega_id')->nullable(false)->change();
        });

        Schema::table('existencias', function (Blueprint $table) {
            $table->foreignId('bodega_id')->nullable(false)->change();
        });
    }
};
