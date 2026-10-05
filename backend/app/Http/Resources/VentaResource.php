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
            'metodo_pago'    => $this->metodo_pago ?? 'efectivo',
            'costo_envio'    => (float) $this->costo_envio,
            'exonerado'            => (bool) $this->exonerado,
            'orden_compra_exenta'  => $this->orden_compra_exenta,
            'constancia_exonerado' => $this->constancia_exonerado,
            'registro_sag'         => $this->registro_sag,
            'vendedor'       => $this->whenLoaded('usuario', fn() => $this->usuario?->nombre),
            'cliente'        => $this->whenLoaded('cliente', fn() => $this->cliente ? ['id' => $this->cliente->id, 'nombre' => $this->cliente->nombre, 'rtn' => $this->cliente->rtn, 'direccion' => $this->cliente->direccion] : null),
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
