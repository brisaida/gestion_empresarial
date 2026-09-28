<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RequisicionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'empresa_id'         => $this->empresa_id,
            'proveedor_id'       => $this->proveedor_id,
            'numero_requisicion' => $this->numero_requisicion,
            'fecha_requisicion'  => $this->fecha_requisicion?->toDateString(),
            'realizado_por'      => $this->realizado_por,
            'observaciones'      => $this->observaciones,
            'estado'             => $this->estado,
            'total_articulos'    => $this->whenCounted('detalles'),
            'autorizado'         => (bool) $this->autorizado_at,
            'autorizado_por'     => $this->whenLoaded('autorizador', fn() => $this->autorizador?->nombre),
            'autorizado_at'      => $this->autorizado_at?->toDateTimeString(),
            'proveedor'          => $this->whenLoaded('proveedor', fn() => $this->proveedor ? [
                'id'        => $this->proveedor->id,
                'nombre'    => $this->proveedor->nombre,
                'rtn'       => $this->proveedor->rtn,
                'telefono'  => $this->proveedor->telefono,
                'correo'    => $this->proveedor->correo,
                'direccion' => $this->proveedor->direccion,
            ] : null),
            'detalles'           => $this->whenLoaded('detalles', fn() =>
                $this->detalles->map(fn($d) => [
                    'id'          => $d->id,
                    'producto_id' => $d->producto_id,
                    'codigo'      => $d->producto?->codigo ?? $d->codigo,
                    'descripcion' => $d->producto?->nombre ?? $d->descripcion,
                    'cantidad'    => (float) $d->cantidad,
                    'imagen_url'  => $d->producto?->imagen ? '/storage/' . $d->producto->imagen : null,
                ])
            ),
            'created_at'         => $this->created_at?->toDateTimeString(),
        ];
    }
}
