<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BodegaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'empresa_id'  => $this->empresa_id,
            'sucursal_id' => $this->sucursal_id,
            'codigo'      => $this->codigo,
            'nombre'      => $this->nombre,
            'activo'      => $this->activo,
            'sucursal'    => $this->whenLoaded('sucursal', fn() => ['id' => $this->sucursal->id, 'nombre' => $this->sucursal->nombre]),
        ];
    }
}
