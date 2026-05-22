<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UnidadMedidaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'empresa_id'  => $this->empresa_id,
            'nombre'      => $this->nombre,
            'abreviatura' => $this->abreviatura,
            'activo'      => $this->activo,
        ];
    }
}
