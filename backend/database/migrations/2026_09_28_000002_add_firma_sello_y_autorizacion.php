<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Firma y sello de la empresa + autorización de documentos con PIN.
 *
 * - La firma y el sello se guardan en la BD (data URI) y no en el disco público:
 *   así nunca tienen una URL accesible y solo se entregan al imprimir un
 *   documento ya autorizado.
 * - Cada usuario con permiso "firmar" define su propio PIN (hash) para autorizar.
 * - Requisiciones y cotizaciones guardan quién y cuándo las autorizó.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->longText('firma_imagen')->nullable();
            $table->longText('sello_imagen')->nullable();
        });

        Schema::table('usuarios', function (Blueprint $table) {
            $table->string('pin_firma')->nullable();
        });

        foreach (['requisiciones', 'cotizaciones'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->foreignId('autorizado_por')->nullable()->constrained('usuarios')->nullOnDelete();
                $table->timestamp('autorizado_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['requisiciones', 'cotizaciones'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->dropConstrainedForeignId('autorizado_por');
                $table->dropColumn('autorizado_at');
            });
        }

        Schema::table('usuarios', function (Blueprint $table) {
            $table->dropColumn('pin_firma');
        });

        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['firma_imagen', 'sello_imagen']);
        });
    }
};
