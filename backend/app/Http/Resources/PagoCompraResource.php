<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PagoCompraResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'compra_id'      => $this->compra_id,
            'proveedor_id'   => $this->proveedor_id,
            'fecha'          => $this->fecha?->toDateString(),
            'monto'          => (float) $this->monto,
            'metodo_pago'    => $this->metodo_pago,
            'desde_caja'     => (bool) $this->desde_caja,
            'tarjeta_credito_id' => $this->tarjeta_credito_id,
            'referencia'     => $this->referencia,
            'observaciones'  => $this->observaciones,
            'anulado'        => (bool) $this->anulado,
            'anulado_at'     => $this->anulado_at?->toDateTimeString(),
            'usuario'        => $this->whenLoaded('usuario', fn() => $this->usuario?->nombre),
            'numero_factura' => $this->whenLoaded('compra', fn() => $this->compra?->numero_factura),
            'proveedor'      => $this->whenLoaded('proveedor', fn() => $this->proveedor?->nombre),
            'created_at'     => $this->created_at?->toDateTimeString(),
        ];
    }
}
