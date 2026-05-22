<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExistenciaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'bodega_id'          => $this->bodega_id,
            'producto_id'        => $this->producto_id,
            'lote'               => $this->lote,
            'fecha_vencimiento'  => $this->fecha_vencimiento?->toDateString(),
            'numero_serie'       => $this->numero_serie,
            'cantidad'           => (float) $this->cantidad,
            'cantidad_reservada' => (float) $this->cantidad_reservada,
            'cantidad_disponible'=> (float) ($this->cantidad - $this->cantidad_reservada),
            'producto'           => $this->whenLoaded('producto', fn() => [
                'id'           => $this->producto->id,
                'codigo'       => $this->producto->codigo,
                'nombre'       => $this->producto->nombre,
                'stock_minimo' => (float) $this->producto->stock_minimo,
                'stock_bajo'   => (float) $this->cantidad <= (float) $this->producto->stock_minimo,
            ]),
            'bodega'             => $this->whenLoaded('bodega', fn() => ['id' => $this->bodega->id, 'nombre' => $this->bodega->nombre]),
        ];
    }
}
