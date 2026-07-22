<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cotizaciones', function (Blueprint $table) {
            $table->dropUnique(['numero_cotizacion']);
            $table->unique(['empresa_id', 'numero_cotizacion']);
        });
    }

    public function down(): void
    {
        Schema::table('cotizaciones', function (Blueprint $table) {
            $table->dropUnique(['empresa_id', 'numero_cotizacion']);
            $table->unique(['numero_cotizacion']);
        });
    }
};
