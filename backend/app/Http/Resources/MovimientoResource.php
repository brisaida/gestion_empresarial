<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MovimientoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'bodega_id'        => $this->bodega_id,
            'usuario_id'       => $this->usuario_id,
            'tipo_movimiento'  => $this->tipo_movimiento,
            'tipo_referencia'  => $this->tipo_referencia,
            'referencia_id'    => $this->referencia_id,
            'numero_documento' => $this->numero_documento,
            'fecha'            => $this->fecha?->toDateString(),
            'observaciones'    => $this->observaciones,
            'bodega'           => $this->whenLoaded('bodega', fn() => ['id' => $this->bodega->id, 'nombre' => $this->bodega->nombre]),
            'usuario'          => $this->whenLoaded('usuario', fn() => ['id' => $this->usuario->id, 'nombre' => $this->usuario->nombre]),
            'detalles'         => $this->whenLoaded('detalles', fn() => $this->detalles->map(fn($d) => [
                'producto_id'    => $d->producto_id,
                'producto'       => $d->producto?->nombre,
                'cantidad'       => (float) $d->cantidad,
                'costo_unitario' => (float) $d->costo_unitario,
                'costo_total'    => (float) $d->costo_total,
                'lote'           => $d->lote,
            ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
