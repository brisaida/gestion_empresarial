<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proveedores', function (Blueprint $table) {
            $table->string('departamento', 100)->nullable()->after('direccion');
            $table->string('municipio',    100)->nullable()->after('departamento');
        });

        Schema::table('clientes', function (Blueprint $table) {
            $table->string('departamento', 100)->nullable()->after('direccion');
            $table->string('municipio',    100)->nullable()->after('departamento');
        });
    }

    public function down(): void
    {
        Schema::table('proveedores', function (Blueprint $table) {
            $table->dropColumn(['departamento', 'municipio']);
        });
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn(['departamento', 'municipio']);
        });
    }
};
