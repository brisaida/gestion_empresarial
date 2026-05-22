<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompraResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'empresa_id'      => $this->empresa_id,
            'proveedor_id'    => $this->proveedor_id,
            'bodega_id'       => $this->bodega_id,
            'numero_factura'  => $this->numero_factura,
            'fecha_compra'    => $this->fecha_compra?->toDateString(),
            'subtotal'        => (float) $this->subtotal,
            'impuesto'        => (float) $this->impuesto,
            'descuento'       => (float) $this->descuento,
            'total'           => (float) $this->total,
            'estado'          => $this->estado,
            'proveedor'       => $this->whenLoaded('proveedor', fn() => ['id' => $this->proveedor->id, 'nombre' => $this->proveedor->nombre]),
            'bodega'          => $this->whenLoaded('bodega', fn() => ['id' => $this->bodega->id, 'nombre' => $this->bodega->nombre]),
            'detalles'        => $this->whenLoaded('detalles', fn() => $this->detalles->map(fn($d) => [
                'id'              => $d->id,
                'producto_id'     => $d->producto_id,
                'producto'        => $d->producto?->nombre,
                'cantidad'        => (float) $d->cantidad,
                'costo_unitario'  => (float) $d->costo_unitario,
                'subtotal'        => (float) $d->subtotal,
                'lote'            => $d->lote,
                'fecha_vencimiento' => $d->fecha_vencimiento?->toDateString(),
            ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
