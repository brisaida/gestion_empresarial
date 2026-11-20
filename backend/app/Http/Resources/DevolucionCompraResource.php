<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DevolucionCompraResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'numero'           => $this->numero,
            'compra_id'         => $this->compra_id,
            'numero_factura'   => $this->whenLoaded('compra', fn() => $this->compra?->numero_factura),
            'proveedor'          => $this->whenLoaded('proveedor', fn() => $this->proveedor ? ['id' => $this->proveedor->id, 'nombre' => $this->proveedor->nombre, 'rtn' => $this->proveedor->rtn] : null),
            'bodega'           => $this->whenLoaded('bodega', fn() => $this->bodega?->nombre),
            'usuario'          => $this->whenLoaded('usuario', fn() => $this->usuario?->nombre),
            'fecha'            => $this->fecha?->toDateString(),
            'motivo'           => $this->motivo,
            'subtotal'         => (float) $this->subtotal,
            'impuesto'         => (float) $this->impuesto,
            'total'            => (float) $this->total,
            'aplicado_a_saldo' => (float) $this->aplicado_a_saldo,
            'reembolsado'      => (float) $this->reembolsado,
            'reembolso_metodo' => $this->reembolso_metodo,
            'desde_caja'       => (bool) $this->desde_caja,
            'detalles'         => $this->whenLoaded('detalles', fn() => $this->detalles->map(fn($d) => [
                'id'          => $d->id,
                'producto_id' => $d->producto_id,
                'nombre'      => $d->producto?->nombre ?? null,
                'codigo'      => $d->producto?->codigo,
                'cantidad'    => (float) $d->cantidad,
                'precio'      => (float) $d->costo_unitario,
                'subtotal'    => (float) $d->subtotal,
            ])),
            'created_at'       => $this->created_at?->toDateTimeString(),
        ];
    }
}
