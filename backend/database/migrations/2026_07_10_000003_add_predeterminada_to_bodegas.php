<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bodegas', function (Blueprint $table) {
            $table->boolean('predeterminada')->default(false)->after('activo');
        });
    }

    public function down(): void
    {
        Schema::table('bodegas', function (Blueprint $table) {
            $table->dropColumn('predeterminada');
        });
    }
};
