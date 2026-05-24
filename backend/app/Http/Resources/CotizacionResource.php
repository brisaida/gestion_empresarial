<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CotizacionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'numero_cotizacion'  => $this->numero_cotizacion,
            'fecha_cotizacion'   => $this->fecha_cotizacion?->toDateString(),
            'fecha_vencimiento'  => $this->fecha_vencimiento?->toDateString(),
            'observaciones'      => $this->observaciones,
            'subtotal'           => (float) $this->subtotal,
            'descuento'          => (float) $this->descuento,
            'impuesto'           => (float) $this->impuesto,
            'total'              => (float) $this->total,
            'estado'             => $this->estado,
            'cliente'            => $this->whenLoaded('cliente', fn() => ['id' => $this->cliente->id, 'nombre' => $this->cliente->nombre]),
            'venta_id'           => $this->venta_id,
            'detalles'           => $this->whenLoaded('detalles', fn() =>
                $this->detalles->map(fn($d) => [
                    'id'              => $d->id,
                    'producto_id'     => $d->producto_id,
                    'cantidad'        => (float) $d->cantidad,
                    'precio_unitario' => (float) $d->precio_unitario,
                    'subtotal'        => (float) $d->subtotal,
                    'producto'        => $d->producto ? ['id' => $d->producto->id, 'codigo' => $d->producto->codigo, 'nombre' => $d->producto->nombre] : null,
                ])
            ),
        ];
    }
}
