<?php

namespace App\Http\Resources;

use App\Models\TarjetaCredito;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TarjetaCreditoResource extends JsonResource
{
    public static function resumen(TarjetaCredito $t): array
    {
        return ['id' => $t->id, 'nombre' => $t->nombre, 'banco' => $t->banco, 'ultimos4' => $t->ultimos4, 'etiqueta' => $t->etiqueta()];
    }

    public function toArray(Request $request): array
    {
        return [
            ...self::resumen($this->resource),
            'dia_corte' => $this->dia_corte,
            'dia_pago'  => $this->dia_pago,
            'limite'    => $this->limite !== null ? (float) $this->limite : null,
            'activo'    => (bool) $this->activo,
        ];
    }
}
