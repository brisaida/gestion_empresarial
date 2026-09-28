<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UsuarioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'nombre'         => $this->nombre,
            'correo'         => $this->correo,
            'activo'         => $this->activo,
            'es_super_admin' => $this->es_super_admin,
            'tiene_pin'      => (bool) $this->pin_firma,
            'created_at'     => $this->created_at?->toDateTimeString(),
        ];
    }
}
