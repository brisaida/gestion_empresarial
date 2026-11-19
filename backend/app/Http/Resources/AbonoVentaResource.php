<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AbonoVentaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'venta_id'       => $this->venta_id,
            'cliente_id'     => $this->cliente_id,
            'fecha'          => $this->fecha?->toDateString(),
            'monto'          => (float) $this->monto,
            'metodo_pago'    => $this->metodo_pago,
            'referencia'     => $this->referencia,
            'observaciones'  => $this->observaciones,
            'anulado'        => (bool) $this->anulado,
            'anulado_at'     => $this->anulado_at?->toDateTimeString(),
            'usuario'        => $this->whenLoaded('usuario', fn() => $this->usuario?->nombre),
            'numero_factura' => $this->whenLoaded('venta', fn() => $this->venta?->numero_factura),
            'cliente'        => $this->whenLoaded('cliente', fn() => $this->cliente?->nombre),
            'created_at'     => $this->created_at?->toDateTimeString(),
        ];
    }
}
