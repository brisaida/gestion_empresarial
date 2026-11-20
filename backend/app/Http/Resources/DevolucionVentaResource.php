<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DevolucionVentaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'numero'           => $this->numero,
            'venta_id'         => $this->venta_id,
            'numero_factura'   => $this->whenLoaded('venta', fn() => $this->venta?->numero_factura),
            'cliente'          => $this->whenLoaded('cliente', fn() => $this->cliente ? ['id' => $this->cliente->id, 'nombre' => $this->cliente->nombre, 'rtn' => $this->cliente->rtn] : null),
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
                'nombre'      => $d->producto?->nombre ?? $d->receta?->nombre ?? $d->descripcion,
                'codigo'      => $d->producto?->codigo,
                'cantidad'    => (float) $d->cantidad,
                'precio'      => (float) $d->precio_unitario,
                'subtotal'    => (float) $d->subtotal,
                'regresa_a_stock' => (bool) $d->regresa_a_stock,
            ])),
            'created_at'       => $this->created_at?->toDateTimeString(),
        ];
    }
}
