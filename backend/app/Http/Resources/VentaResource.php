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
            'cai'              => $this->cai,
            'cai_rango_desde'  => $this->cai_rango_desde,
            'cai_rango_hasta'  => $this->cai_rango_hasta,
            'cai_fecha_limite' => $this->cai_fecha_limite?->toDateString(),
            'fecha_venta'    => $this->fecha_venta?->toDateString(),
            'subtotal'       => (float) $this->subtotal,
            'impuesto'       => (float) $this->impuesto,
            'descuento'      => (float) $this->descuento,
            'total'          => (float) $this->total,
            'estado'         => $this->estado,
            // En una venta al crédito el método de pago no aplica (lo que entra son los abonos)
            'metodo_pago'    => $this->condicion === 'credito' ? null : ($this->metodo_pago ?? 'efectivo'),
            'condicion'         => $this->condicion ?? 'contado',
            'dias_credito'      => $this->dias_credito,
            'fecha_vencimiento' => $this->fecha_vencimiento?->toDateString(),
            'saldo_pendiente'   => (float) $this->saldo_pendiente,
            'total_abonado'     => $this->condicion === 'credito' && $this->estado !== 'cancelada'
                ? round((float) $this->total - (float) $this->saldo_pendiente, 2) : 0,
            'estado_pago'       => $this->resource->estadoPago(),
            'dias_vencida'      => $this->resource->estadoPago() === 'vencida'
                ? (int) $this->fecha_vencimiento->diffInDays(today()) : 0,
            'abonos'            => $this->whenLoaded('abonos', fn() => AbonoVentaResource::collection(
                $this->abonos->sortByDesc('id')->values()
            )),
            'costo_envio'    => (float) $this->costo_envio,
            'exonerado'            => (bool) $this->exonerado,
            'orden_compra_exenta'  => $this->orden_compra_exenta,
            'constancia_exonerado' => $this->constancia_exonerado,
            'registro_sag'         => $this->registro_sag,
            'vendedor'       => $this->whenLoaded('usuario', fn() => $this->usuario?->nombre),
            'cliente'        => $this->whenLoaded('cliente', fn() => $this->cliente ? ['id' => $this->cliente->id, 'nombre' => $this->cliente->nombre, 'rtn' => $this->cliente->rtn, 'direccion' => $this->cliente->direccion, 'telefono' => $this->cliente->telefono] : null),
            'bodega'         => $this->whenLoaded('bodega', fn() => ['id' => $this->bodega->id, 'nombre' => $this->bodega->nombre]),
            'detalles'       => $this->whenLoaded('detalles', fn() => $this->detalles->map(fn($d) => [
                'id'              => $d->id,
                'producto_id'     => $d->producto_id,
                'producto'        => $d->producto?->nombre ?? $d->descripcion,
                'codigo'          => $d->producto?->codigo,
                'unidad'          => $d->producto?->unidadMedida?->abreviatura,
                'tasa_isv'        => $d->producto?->tasa_isv !== null ? (float) $d->producto->tasa_isv : null,
                'descripcion'     => $d->descripcion,
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
