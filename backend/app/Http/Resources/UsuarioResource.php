<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UsuarioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'     => $this->id,
            'nombre' => $this->nombre,
            'correo' => $this->correo,
            'activo' => $this->activo,
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
