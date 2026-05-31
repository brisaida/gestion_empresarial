<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->string('tamaño', 50)->nullable()->after('descripcion');
            $table->decimal('peso', 10, 3)->nullable()->after('tamaño');
            $table->decimal('largo', 10, 2)->nullable()->after('peso');
            $table->decimal('ancho', 10, 2)->nullable()->after('largo');
            $table->decimal('alto',  10, 2)->nullable()->after('ancho');
        });
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropColumn(['tamaño', 'peso', 'largo', 'ancho', 'alto']);
        });
    }
};
