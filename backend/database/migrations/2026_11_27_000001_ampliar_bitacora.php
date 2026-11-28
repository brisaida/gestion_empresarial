<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La bitácora empieza a usarse: registra automáticamente quién crea, edita, cancela o elimina.
 * - empresa_id nulo: eventos globales (roles, usuarios, inicios de sesión).
 * - usuario_id nulo: intentos de inicio de sesión fallidos con un correo que no existe.
 * - entidad_tipo / entidad_id: el registro afectado, para ver el historial de un documento.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bitacora', function (Blueprint $table) {
            $table->unsignedBigInteger('empresa_id')->nullable()->change();
            $table->unsignedBigInteger('usuario_id')->nullable()->change();
            $table->string('entidad_tipo', 60)->nullable()->after('accion');
            $table->unsignedBigInteger('entidad_id')->nullable()->after('entidad_tipo');

            $table->index(['entidad_tipo', 'entidad_id']);
            $table->index(['usuario_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::table('bitacora', function (Blueprint $table) {
            $table->dropIndex(['entidad_tipo', 'entidad_id']);
            $table->dropIndex(['usuario_id', 'fecha']);
            $table->dropColumn(['entidad_tipo', 'entidad_id']);
        });
        // empresa_id / usuario_id quedan nulos: no se pueden volver obligatorios si ya hay filas sin ellos.
    }
};
