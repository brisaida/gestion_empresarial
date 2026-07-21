<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('producto_categorias', function (Blueprint $table) {
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('categoria_id')->constrained('categorias')->cascadeOnDelete();
            $table->primary(['producto_id', 'categoria_id']);
        });

        DB::statement('
            INSERT INTO producto_categorias (producto_id, categoria_id)
            SELECT id, categoria_id FROM productos WHERE categoria_id IS NOT NULL
        ');

        Schema::table('productos', function (Blueprint $table) {
            $table->dropForeign(['categoria_id']);
            $table->dropColumn('categoria_id');
        });
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->foreignId('categoria_id')->nullable()->constrained('categorias')->nullOnDelete();
        });

        DB::statement('
            UPDATE productos SET categoria_id = (
                SELECT pc.categoria_id FROM producto_categorias pc
                WHERE pc.producto_id = productos.id LIMIT 1
            )
        ');

        Schema::dropIfExists('producto_categorias');
    }
};
