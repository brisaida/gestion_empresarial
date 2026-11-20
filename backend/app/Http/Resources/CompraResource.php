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
            'costo_envio'     => (float) $this->costo_envio,
            'total'           => (float) $this->total,
            'estado'          => $this->estado,
            'condicion'         => $this->condicion ?? 'contado',
            'metodo_pago'       => $this->metodo_pago,
            'dias_credito'      => $this->dias_credito,
            'fecha_vencimiento' => $this->fecha_vencimiento?->toDateString(),
            'saldo_pendiente'   => (float) $this->saldo_pendiente,
            'total_pagado'      => $this->condicion === 'credito' && $this->estado !== 'cancelada'
                ? round((float) $this->total - (float) $this->saldo_pendiente - (float) $this->devuelto_a_saldo, 2) : 0,
            'monto_devuelto'    => (float) $this->monto_devuelto,
            'motivo_cancelacion' => $this->motivo_cancelacion,
            'cancelada_at'      => $this->cancelada_at?->toDateTimeString(),
            'cancelada_por'     => $this->whenLoaded('canceladaPor', fn() => $this->canceladaPor?->nombre),
            'devoluciones'      => $this->whenLoaded('devoluciones', fn() => DevolucionCompraResource::collection($this->devoluciones)),
            'estado_pago'       => $this->resource->estadoPago(),
            'dias_vencida'      => $this->resource->estadoPago() === 'vencida'
                ? (int) $this->fecha_vencimiento->diffInDays(today()) : 0,
            'pagos'             => $this->whenLoaded('pagos', fn() => PagoCompraResource::collection($this->pagos->sortByDesc('id')->values())),
            'proveedor'       => $this->whenLoaded('proveedor', fn() => ['id' => $this->proveedor->id, 'nombre' => $this->proveedor->nombre, 'rtn' => $this->proveedor->rtn]),
            'bodega'          => $this->whenLoaded('bodega', fn() => ['id' => $this->bodega->id, 'nombre' => $this->bodega->nombre]),
            'detalles'        => $this->whenLoaded('detalles', fn() => $this->detalles->map(fn($d) => [
                'id'              => $d->id,
                'producto_id'     => $d->producto_id,
                'producto'        => $d->producto ? ['id' => $d->producto->id, 'codigo' => $d->producto->codigo, 'nombre' => $d->producto->nombre] : null,
                'cantidad'        => (float) $d->cantidad,
                'costo_unitario'  => (float) $d->costo_unitario,
                'subtotal'        => (float) $d->subtotal,
                'cantidad_devuelta' => (float) ($d->cantidad_devuelta ?? 0),
                'lote'            => $d->lote,
                'fecha_vencimiento' => $d->fecha_vencimiento?->toDateString(),
            ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
