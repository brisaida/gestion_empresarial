<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $defaults = [
        ['nombre' => 'Unidad',     'abreviatura' => 'UND'],
        ['nombre' => 'Caja',       'abreviatura' => 'CJA'],
        ['nombre' => 'Paquete',    'abreviatura' => 'PKT'],
        ['nombre' => 'Docena',     'abreviatura' => 'DOC'],
        ['nombre' => 'Kilogramo',  'abreviatura' => 'KG'],
        ['nombre' => 'Gramo',      'abreviatura' => 'GR'],
        ['nombre' => 'Libra',      'abreviatura' => 'LB'],
        ['nombre' => 'Litro',      'abreviatura' => 'LT'],
        ['nombre' => 'Mililitro',  'abreviatura' => 'ML'],
        ['nombre' => 'Metro',      'abreviatura' => 'MT'],
        ['nombre' => 'Centímetro', 'abreviatura' => 'CM'],
        ['nombre' => 'Par',        'abreviatura' => 'PAR'],
    ];

    public function up(): void
    {
        $empresas = DB::table('empresas')->pluck('id');

        foreach ($empresas as $empresaId) {
            $tiene = DB::table('unidades_medida')
                ->where('empresa_id', $empresaId)
                ->exists();

            if ($tiene) continue;

            $now = now();
            $rows = array_map(fn($u) => [
                'empresa_id'  => $empresaId,
                'nombre'      => $u['nombre'],
                'abreviatura' => $u['abreviatura'],
                'activo'      => true,
                'created_at'  => $now,
                'updated_at'  => $now,
            ], $this->defaults);

            DB::table('unidades_medida')->insert($rows);
        }
    }

    public function down(): void {}
};
