<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmpresaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'nombre'       => $this->nombre,
            'nombre_legal' => $this->nombre_legal,
            'rtn'          => $this->rtn,
            'correo'       => $this->correo,
            'telefono'     => $this->telefono,
            'direccion'    => $this->direccion,
            'logo'         => $this->logo,
            'activo'       => $this->activo,
        ];
    }
}
