<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VentaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'empresa_id'     => $this->empresa_id,
            'cliente_id'     => $this->cliente_id,
            'bodega_id'      => $this->bodega_id,
            'numero_factura' => $this->numero_factura,
            'fecha_venta'    => $this->fecha_venta?->toDateString(),
            'subtotal'       => (float) $this->subtotal,
            'impuesto'       => (float) $this->impuesto,
            'descuento'      => (float) $this->descuento,
            'total'          => (float) $this->total,
            'estado'         => $this->estado,
            'cliente'        => $this->whenLoaded('cliente', fn() => ['id' => $this->cliente->id, 'nombre' => $this->cliente->nombre]),
            'bodega'         => $this->whenLoaded('bodega', fn() => ['id' => $this->bodega->id, 'nombre' => $this->bodega->nombre]),
            'detalles'       => $this->whenLoaded('detalles', fn() => $this->detalles->map(fn($d) => [
                'id'              => $d->id,
                'producto_id'     => $d->producto_id,
                'producto'        => $d->producto?->nombre,
                'receta_id'       => $d->receta_id,
                'receta'          => $d->receta?->nombre,
                'cantidad'        => (float) $d->cantidad,
                'precio_unitario' => (float) $d->precio_unitario,
                'subtotal'        => (float) $d->subtotal,
            ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
